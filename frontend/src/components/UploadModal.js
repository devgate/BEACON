import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faTimes } from '@fortawesome/free-solid-svg-icons';

const UploadModal = ({ categories, onUpload, onClose }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState('4');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUpload = async (file) => {
    if (!file.type.includes('pdf')) {
      alert('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('업로드 중...');
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      await onUpload(file, selectedCategoryId);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('업로드 완료!');
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      clearInterval(progressInterval);
      setUploadStatus('업로드 실패');
      setIsUploading(false);
      alert('파일 업로드 중 오류가 발생했습니다: ' + error.message);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-area">
        <div className="upload-header">
          <h3>PDF 파일 업로드</h3>
          <button className="close-upload-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="category-selection">
          <label htmlFor="categorySelect">카테고리 선택:</label>
          <select 
            id="categorySelect"
            className="category-select"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        
        <div 
          className={`upload-zone ${isDragging ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <FontAwesomeIcon icon={faCloudUploadAlt} className="upload-icon" size="3x" />
          <p>PDF 파일을 드래그하거나 클릭하여 업로드하세요</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <button 
            className="select-file-btn"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
          >
            파일 선택
          </button>
        </div>
        
        {isUploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p>{uploadStatus}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadModal;