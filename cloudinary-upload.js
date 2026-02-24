// cloudinary-upload.js - Fixed with check for existing declaration
(function() {
    // Check if already defined
    if (window.CloudinaryUploader) {
        console.log('CloudinaryUploader already defined, skipping...');
        return;
    }

    class CloudinaryUploader {
        constructor() {
            this.cloudName = 'dftjnisn5';
            this.apiKey = '222912194324751';
            this.uploadPreset = 'taskflow_uploads';
            this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/upload`;
        }

        async uploadFile(file, folder = 'tasks') {
            // Validate file first
            const validation = this.validateFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', this.uploadPreset);
                formData.append('folder', folder);
                
                const response = await fetch(this.uploadUrl, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error?.message || 'Upload failed');
                }
                
                const data = await response.json();
                
                return {
                    url: data.secure_url,
                    publicId: data.public_id,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    format: data.format,
                    width: data.width,
                    height: data.height,
                    uploadedAt: new Date().toISOString()
                };
                
            } catch (error) {
                console.error('Cloudinary upload failed:', error);
                return this.fallbackUpload(file);
            }
        }

        async fallbackUpload(file) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch('https://file.io/?expires=1d', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    return {
                        url: data.link,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        uploadedAt: new Date().toISOString(),
                        expires: data.expires,
                        note: 'This file will expire in 24 hours or after 1 download'
                    };
                } else {
                    throw new Error('Fallback upload failed');
                }
            } catch (fallbackError) {
                throw new Error('All upload methods failed. Please try again later.');
            }
        }

        validateFile(file) {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf', 'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain', 'text/csv',
                'video/mp4', 'video/webm',
                'audio/mpeg', 'audio/wav'
            ];
            
            if (file.size > maxSize) {
                return {
                    valid: false,
                    error: `File "${file.name}" exceeds 10MB limit`
                };
            }
            
            if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
                return {
                    valid: false,
                    error: `File type "${file.type}" is not supported`
                };
            }
            
            return { valid: true };
        }

        getFileIcon(fileType) {
            if (fileType.startsWith('image/')) return 'bi bi-file-image';
            if (fileType.startsWith('video/')) return 'bi bi-file-play';
            if (fileType.startsWith('audio/')) return 'bi bi-file-music';
            if (fileType.includes('pdf')) return 'bi bi-file-pdf';
            if (fileType.includes('word')) return 'bi bi-file-word';
            if (fileType.includes('excel')) return 'bi bi-file-excel';
            if (fileType.includes('text')) return 'bi bi-file-text';
            return 'bi bi-file-earmark';
        }

        async compressImage(file, maxWidth = 1920, quality = 0.8) {
            return new Promise((resolve, reject) => {
                if (!file.type.startsWith('image/')) {
                    resolve(file);
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

        getOptimizedUrl(publicId, options = {}) {
            const baseUrl = `https://res.cloudinary.com/${this.cloudName}/image/upload`;
            const transformations = [];
            
            transformations.push('q_auto,f_auto');
            
            if (options.width) transformations.push(`w_${options.width}`);
            if (options.height) transformations.push(`h_${options.height}`);
            if (options.crop) transformations.push(`c_${options.crop}`);
            
            const transformationString = transformations.join(',');
            
            if (transformationString) {
                return `${baseUrl}/${transformationString}/${publicId}`;
            }
            
            return `${baseUrl}/${publicId}`;
        }
    }

    // Create global instance only if not exists
    if (!window.cloudinaryUploader) {
        window.cloudinaryUploader = new CloudinaryUploader();
    }
})();