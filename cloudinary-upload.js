// cloudinary-upload.js
class CloudinaryUploader {
    constructor() {
        this.cloudName = 'dftjnisn5';
        this.apiKey = '222912194324751';
        this.uploadPreset = 'taskflow_uploads'; // You'll need to create this in Cloudinary
        this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/upload`;
    }

    async uploadFile(file, folder = 'tasks') {
        return new Promise((resolve, reject) => {
            // Check file size (Cloudinary free tier: 10MB max)
            if (file.size > 10 * 1024 * 1024) {
                reject(new Error('File size must be less than 10MB'));
                return;
            }

            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.uploadPreset);
            formData.append('folder', folder);
            formData.append('api_key', this.apiKey);
            
            // Add optimization parameters
            formData.append('transformation', 'q_auto,f_auto');
            
            // Upload to Cloudinary
            fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    reject(new Error(data.error.message));
                } else {
                    resolve({
                        url: data.secure_url,
                        publicId: data.public_id,
                        format: data.format,
                        size: data.bytes,
                        width: data.width,
                        height: data.height,
                        createdAt: data.created_at
                    });
                }
            })
            .catch(error => {
                console.error('Cloudinary upload error:', error);
                reject(new Error('Failed to upload file. Please try again.'));
            });
        });
    }

    async uploadMultipleFiles(files, folder = 'tasks') {
        const uploadPromises = files.map(file => this.uploadFile(file, folder));
        return Promise.all(uploadPromises);
    }

    async deleteFile(publicId) {
        try {
            // Note: To delete files, you'll need to use server-side code
            // or Cloudinary's Admin API with your api_secret
            // This is a placeholder for the delete functionality
            console.log('Delete would be implemented with server-side code');
            
            // For client-side, we can only upload, not delete
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }

    getOptimizedUrl(publicId, options = {}) {
        const baseUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload`;
        const transformations = [];
        
        // Default optimizations
        transformations.push('q_auto,f_auto');
        
        // Custom transformations
        if (options.width) transformations.push(`w_${options.width}`);
        if (options.height) transformations.push(`h_${options.height}`);
        if (options.crop) transformations.push(`c_${options.crop}`);
        
        const transformationString = transformations.join(',');
        
        if (transformationString) {
            return `${baseUrl}/${transformationString}/${publicId}`;
        }
        
        return `${baseUrl}/${publicId}`;
    }

    getVideoUrl(publicId, options = {}) {
        const baseUrl = `https://res.cloudinary.com/${this.cloudName}/video/upload`;
        const transformations = [];
        
        transformations.push('q_auto');
        
        if (options.width) transformations.push(`w_${options.width}`);
        
        const transformationString = transformations.join(',');
        
        if (transformationString) {
            return `${baseUrl}/${transformationString}/${publicId}`;
        }
        
        return `${baseUrl}/${publicId}`;
    }

    // Helper to get file type icon
    getFileIcon(fileType) {
        const type = fileType.split('/')[0];
        const extension = fileType.split('/')[1];
        
        switch (type) {
            case 'image':
                return 'bi bi-file-image';
            case 'video':
                return 'bi bi-file-play';
            case 'audio':
                return 'bi bi-file-music';
            case 'application':
                if (extension.includes('pdf')) return 'bi bi-file-pdf';
                if (extension.includes('zip') || extension.includes('rar')) return 'bi bi-file-zip';
                if (extension.includes('word') || extension.includes('document')) return 'bi bi-file-word';
                if (extension.includes('excel') || extension.includes('sheet')) return 'bi bi-file-excel';
                return 'bi bi-file-earmark';
            default:
                return 'bi bi-file-earmark';
        }
    }

    // Validate file before upload
    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        // Get file extension
        const extension = file.name.split('.').pop().toLowerCase();
        const mimeType = file.type.toLowerCase();
        
        // Allowed extensions and MIME types
        const allowedExtensions = {
            images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff'],
            documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv'],
            videos: ['mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv'],
            audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
            archives: ['zip', 'rar', '7z', 'tar', 'gz']
        };
        
        const allowedMimeTypes = [
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon',
            
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'text/csv', 'text/rtf',
            
            // Videos
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
            
            // Audio
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/flac',
            
            // Archives
            'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
            'application/x-tar', 'application/gzip'
        ];
        
        // Check file size
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File "${file.name}" is too large. Maximum size is 10MB.`
            };
        }
        
        // Check if extension is allowed
        const isExtensionAllowed = Object.values(allowedExtensions)
            .flat()
            .includes(extension);
        
        // Check if MIME type is allowed
        const isMimeTypeAllowed = allowedMimeTypes.includes(mimeType) || 
                                mimeType.startsWith('image/') || 
                                mimeType.startsWith('video/') || 
                                mimeType.startsWith('audio/');
        
        if (!isExtensionAllowed && !isMimeTypeAllowed) {
            return {
                valid: false,
                error: `File type "${extension}" is not supported. Please upload images, documents, videos, or audio files.`
            };
        }
        
        return { valid: true };
    }

    // Compress image before upload (for large images)
    async compressImage(file, maxWidth = 1920, quality = 0.8) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                resolve(file); // Return non-image files as-is
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Resize if larger than maxWidth
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
        });
    }
}

// Create global instance
const cloudinaryUploader = new CloudinaryUploader();