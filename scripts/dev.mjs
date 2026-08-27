#!/usr/bin/env node
/**
 * Launcher de desarrollo: levanta backend + frontend con concurrently, pero antes
 * verifica que los puertos estén libres. Si alguno está ocupado, pregunta qué hacer
 * (usar otro puerto, liberar el actual, elegir uno a mano o cancelar).
 */
import concurrently from 'concurrently';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join } from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const interactive = process.stdin.isTTY && process.stdout.isTTY;

const c = {
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
};

/** Lee una variable de un archivo .env sin dependencias externas. */
function readEnvVar(file, key) {
    try {
        const content = readFileSync(join(ROOT, file), 'utf8');
        const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\r\\n#]*)["']?`, 'm'));
        return match ? match[1].trim() : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Un proceso puede estar escuchando solo en IPv4 (0.0.0.0) o solo en IPv6 (::),
 * así que probamos ambas familias: si cualquiera da EADDRINUSE, el puerto está tomado.
 */
function canBind(port, host) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => resolve(err.code !== 'EADDRINUSE'));
        server.listen({ port, host, ipv6Only: false }, () => server.close(() => resolve(true)));
    });
}

async function isPortFree(port) {
    for (const host of ['0.0.0.0', '::']) {
        if (!(await canBind(port, host))) return false;
    }
    return true;
}

async function findFreePort(from, taken = []) {
    for (let port = from; port < from + 100; port++) {
        if (taken.includes(port)) continue;
        if (await isPortFree(port)) return port;
    }
    throw new Error(`No se encontró ningún puerto libre a partir del ${from}`);
}

/** Devuelve [{ pid, command }] de los procesos escuchando en el puerto. */
function processesOnPort(port) {
    try {
        const pids = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        return [...new Set(pids)].map((pid) => {
            let command = 'proceso desconocido';
            try {
                command = execFileSync('ps', ['-p', pid, '-o', 'command='], {
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore'],
                }).trim();
            } catch { /* el proceso puede haber terminado recién */ }
            return { pid, command };
        });
    } catch {
        return [];
    }
}

async function killProcesses(procs, port) {
    for (const { pid } of procs) {
        try { process.kill(Number(pid), 'SIGTERM'); } catch { /* ya no existe */ }
    }
    // Esperamos hasta 5s a que el puerto quede libre; si no, SIGKILL.
    for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (await isPortFree(port)) return true;
    }
    for (const { pid } of procs) {
        try { process.kill(Number(pid), 'SIGKILL'); } catch { /* ya no existe */ }
    }
    for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (await isPortFree(port)) return true;
    }
    return false;
}

/** Resuelve el puerto a usar para un servicio, preguntando si está ocupado. */
async function resolvePort(rl, { label, port, taken }) {
    if (await isPortFree(port)) return port;

    const procs = processesOnPort(port);
    const suggested = await findFreePort(port + 1, taken);

    console.log('');
    console.log(c.yellow(`⚠  El puerto ${c.bold(port)} (${label}) está ocupado.`));
    for (const { pid, command } of procs) {
        console.log(c.dim(`   PID ${pid} → ${command}`));
    }

    if (!interactive) {
        console.log(c.dim(`   Modo no interactivo: uso el puerto libre ${suggested}.`));
        return suggested;
    }

    console.log('');
    console.log(`   ${c.bold('1)')} Usar el puerto libre ${c.green(suggested)} ${c.dim('(recomendado)')}`);
    console.log(`   ${c.bold('2)')} Liberar el ${port}${procs.length ? ` (terminar ${procs.map((p) => `PID ${p.pid}`).join(', ')})` : ''} y usarlo`);
    console.log(`   ${c.bold('3)')} Elegir otro puerto a mano`);
    console.log(`   ${c.bold('4)')} Cancelar`);
    console.log('');

    while (true) {
        const answer = (await rl.question(`   ¿Qué hago con ${label}? [1] `)).trim() || '1';

        if (answer === '1') return suggested;

        if (answer === '2') {
            if (!procs.length) {
                console.log(c.red('   No pude identificar el proceso (¿lsof disponible?). Elegí otra opción.'));
                continue;
            }
            console.log(c.dim('   Terminando proceso...'));
            if (await killProcesses(procs, port)) {
                console.log(c.green(`   Puerto ${port} liberado.`));
                return port;
            }
            console.log(c.red(`   No pude liberar el puerto ${port}. Elegí otra opción.`));
            continue;
        }

        if (answer === '3') {
            const custom = Number((await rl.question('   Puerto: ')).trim());
            if (!Number.isInteger(custom) || custom < 1 || custom > 65535) {
                console.log(c.red('   Puerto inválido.'));
                continue;
            }
            if (taken.includes(custom)) {
                console.log(c.red(`   El puerto ${custom} ya lo va a usar el otro servicio.`));
                continue;
            }
            if (!(await isPortFree(custom))) {
                console.log(c.red(`   El puerto ${custom} también está ocupado.`));
                continue;
            }
            return custom;
        }

        if (answer === '4') {
            console.log(c.dim('   Cancelado.'));
            process.exit(0);
        }

        console.log(c.red('   Opción inválida.'));
    }
}

async function main() {
    const defaultBackendPort = Number(readEnvVar('backend/.env', 'PORT')) || 3000;
    const defaultFrontendPort = Number(readEnvVar('frontend/.env', 'PORT')) || 3001;
    const configuredApiUrl = readEnvVar('frontend/.env', 'REACT_APP_API_URL') || '';

    const rl = interactive
        ? readline.createInterface({ input: process.stdin, output: process.stdout })
        : null;

    let backendPort;
    let frontendPort;
    try {
        backendPort = await resolvePort(rl, {
            label: 'backend',
            port: defaultBackendPort,
            taken: [defaultFrontendPort],
        });
        frontendPort = await resolvePort(rl, {
            label: 'frontend',
            port: defaultFrontendPort,
            taken: [backendPort],
        });
    } finally {
        rl?.close();
    }

    const frontendEnv = { PORT: String(frontendPort) };

    // Si el frontend apunta a un backend local, seguimos el puerto que terminó usando.
    // Si apunta a un backend remoto (Railway, Vercel), no lo tocamos.
    const apiIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(configuredApiUrl.trim());
    if (apiIsLocal || !configuredApiUrl) {
        frontendEnv.REACT_APP_API_URL = `http://localhost:${backendPort}`;
    }

    console.log('');
    console.log(c.bold('  Levantando GymHour'));
    console.log(`  backend   → ${c.green(`http://localhost:${backendPort}`)}`);
    console.log(`  frontend  → ${c.green(`http://localhost:${frontendPort}`)}`);
    if (!apiIsLocal && configuredApiUrl) {
        console.log(c.dim(`  API del frontend apuntando a ${configuredApiUrl} (definido en frontend/.env)`));
    }
    console.log('');

    const { result } = concurrently(
        [
            {
                command: 'npm run dev:backend',
                name: 'backend',
                prefixColor: 'blue',
                env: { PORT: String(backendPort) },
            },
            {
                command: 'npm run dev:frontend',
                name: 'frontend',
                prefixColor: 'green',
                env: frontendEnv,
            },
        ],
        { prefix: 'name', cwd: ROOT }
    );

    result.then(
        () => { process.exitCode = 0; },
        () => { process.exitCode = 1; }
    );
}

main().catch((err) => {
    console.error(c.red(`Error: ${err.message}`));
    process.exit(1);
});
