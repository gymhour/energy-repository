import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
    secure: true,
});

// Ahora acepta un folder opcional (por defecto 'users')
export const uploadImageBuffer = (
    buffer: Buffer,
    publicId: string,
    folder: string = 'users'
): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
        const readable = new Readable();
        readable._read = () => { };
        readable.push(buffer);
        readable.push(null);

        const stream = cloudinary.uploader.upload_stream(
            {
                public_id: publicId,
                folder,                   // usa la carpeta que pases
                use_filename: true,
                unique_filename: false,
                overwrite: true
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result!);
            }
        );

        readable.pipe(stream);
    });
};

export const getImageUrl = (publicId: string, options?: Record<string, any>): string => {
    return cloudinary.url(publicId, {
        secure: true,
        ...options,
    });
};

export const deleteImage = async (publicId: string): Promise<void> => {
    await cloudinary.uploader.destroy(publicId);
};