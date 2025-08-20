import React, { useState, useEffect } from 'react';
import './VisionTestPage.css';

const VisionTestPage = () => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [config, setConfig] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Load configuration on component mount
  useEffect(() => {
    fetch('/api/vision/config')
      .then(response => response.json())
      .then(data => {
        setConfig(data);
      })
      .catch(error => {
        console.error('Failed to load config:', error);
      });
  }, []);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setUploadStatus('Error: Only PDF files are supported');
        return;
      }
      if (selectedFile.size > 16 * 1024 * 1024) {
        setUploadStatus('Error: File size must be less than 16MB');
        return;
      }
      setFile(selectedFile);
      setUploadStatus('');
      setAnalysisResult(null);
      setUploadedFileName('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/vision/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus(`Upload successful: ${result.filename}`);
        setUploadedFileName(result.filename);
      } else {
        setUploadStatus(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFileName) {
      setAnalysisStatus('Please upload a file first');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus('Analyzing PDF with vision AI...');

    try {
      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: uploadedFileName,
          options: {
            extract_text: true,
            extract_images: true,
            analyze_images: true,
          },
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        
        if (response.ok) {
          setAnalysisStatus('Analysis completed successfully!');
          setAnalysisResult(result.analysis);
        } else {
          setAnalysisStatus(`Analysis failed: ${result.error}`);
          setAnalysisResult(null);
        }
      } else {
        // Handle HTML or other non-JSON responses
        const textResponse = await response.text();
        console.error('Non-JSON response received:', textResponse);
        setAnalysisStatus(`Analysis failed: Unexpected response format (got HTML instead of JSON). Check browser console for details.`);
        setAnalysisResult(null);
      }
    } catch (error) {
      console.error('Analysis request error:', error);
      setAnalysisStatus(`Analysis failed: ${error.message}`);
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExtractImages = async () => {
    if (!uploadedFileName) {
      setAnalysisStatus('Please upload a file first');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus('Extracting images from PDF...');

    try {
      const response = await fetch('/api/vision/extract-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: uploadedFileName,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAnalysisStatus(`Image extraction completed! Found ${result.total_images} images`);
        setAnalysisResult({
          image_extraction_only: true,
          total_images: result.total_images,
          images: result.images,
        });
      } else {
        setAnalysisStatus(`Image extraction failed: ${result.error}`);
        setAnalysisResult(null);
      }
    } catch (error) {
      setAnalysisStatus(`Image extraction failed: ${error.message}`);
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    if (analysisResult.image_extraction_only) {
      return (
        <div className="analysis-result">
          <h3>Image Extraction Results</h3>
          <div className="result-summary">
            <p><strong>Total Images Found:</strong> {analysisResult.total_images}</p>
          </div>
          
          {analysisResult.images && analysisResult.images.length > 0 && (
            <div className="images-list">
              <h4>Extracted Images:</h4>
              {analysisResult.images.map((img, index) => (
                <div key={index} className="image-info">
                  <p><strong>ID:</strong> {img.id}</p>
                  <p><strong>Page:</strong> {img.page_number}</p>
                  <p><strong>Size:</strong> {img.size ? `${img.size[0]}x${img.size[1]}` : 'Unknown'}</p>
                  <p><strong>Format:</strong> {img.format}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="analysis-result">
        <h3>Vision Analysis Results</h3>
        
        <div className="result-summary">
          <p><strong>Total Images:</strong> {analysisResult.total_images}</p>
          <p><strong>Text Length:</strong> {analysisResult.text_length} characters</p>
          {analysisResult.summary && (
            <>
              <p><strong>Total Entities:</strong> {analysisResult.summary.total_entities}</p>
              <p><strong>Total Relationships:</strong> {analysisResult.summary.total_relationships}</p>
              <p><strong>Entity Types:</strong> {analysisResult.summary.entity_types?.join(', ')}</p>
              <p><strong>Relation Types:</strong> {analysisResult.summary.relation_types?.join(', ')}</p>
            </>
          )}
        </div>

        {analysisResult.image_analyses && (
          <div className="image-analyses">
            <h4>Image Analysis Details:</h4>
            {analysisResult.image_analyses.map((imgAnalysis, index) => (
              <div key={index} className="image-analysis">
                <h5>Image: {imgAnalysis.image_id} (Page {imgAnalysis.page_number})</h5>
                <p><strong>Context:</strong> {imgAnalysis.analysis.context}</p>
                
                {imgAnalysis.analysis.entities && imgAnalysis.analysis.entities.length > 0 && (
                  <div className="entities">
                    <h6>Entities Found:</h6>
                    <ul>
                      {imgAnalysis.analysis.entities.map((entity, entityIndex) => (
                        <li key={entityIndex}>
                          <strong>{entity.name}</strong> ({entity.type}) - {entity.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {imgAnalysis.analysis.relationships && imgAnalysis.analysis.relationships.length > 0 && (
                  <div className="relationships">
                    <h6>Relationships:</h6>
                    <ul>
                      {imgAnalysis.analysis.relationships.map((rel, relIndex) => (
                        <li key={relIndex}>
                          {rel.relation_type}: {rel.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {analysisResult.graph_data && (
          <div className="graph-data">
            <h4>Graph Structure:</h4>
            <p><strong>Nodes:</strong> {analysisResult.graph_data.nodes?.length}</p>
            <p><strong>Edges:</strong> {analysisResult.graph_data.edges?.length}</p>
            
            <details>
              <summary>View Raw Graph Data</summary>
              <pre>{JSON.stringify(analysisResult.graph_data, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="vision-test-page">
      <div className="header">
        <h1>Vision API Test</h1>
        <p>Upload PDF files to test image extraction and vision analysis capabilities</p>
      </div>

      {config && (
        <div className="config-status">
          <h3>Service Status</h3>
          <div className="status-grid">
            <div className={`status-item ${config.openai_configured ? 'enabled' : 'disabled'}`}>
              <span>OpenAI Vision</span>
              <span>{config.openai_configured ? '✓' : '✗'}</span>
            </div>
            <div className={`status-item ${config.bedrock_configured ? 'enabled' : 'disabled'}`}>
              <span>AWS Bedrock</span>
              <span>{config.bedrock_configured ? '✓' : '✗'}</span>
            </div>
            <div className={`status-item ${config.features.image_extraction ? 'enabled' : 'disabled'}`}>
              <span>Image Extraction</span>
              <span>{config.features.image_extraction ? '✓' : '✗'}</span>
            </div>
            <div className={`status-item ${config.features.vision_analysis ? 'enabled' : 'disabled'}`}>
              <span>Vision Analysis</span>
              <span>{config.features.vision_analysis ? '✓' : '✗'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="upload-section">
        <h3>Upload PDF File</h3>
        <div className="file-input-container">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="file-input"
            id="pdf-file"
          />
          <label htmlFor="pdf-file" className="file-label">
            {file ? file.name : 'Choose PDF file...'}
          </label>
        </div>
        
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="upload-btn"
        >
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
        
        {uploadStatus && (
          <div className={`status-message ${uploadStatus.includes('Error') ? 'error' : 'success'}`}>
            {uploadStatus}
          </div>
        )}
      </div>

      <div className="analysis-section">
        <h3>Analysis Options</h3>
        <div className="button-group">
          <button
            onClick={handleExtractImages}
            disabled={!uploadedFileName || isAnalyzing}
            className="analysis-btn"
          >
            {isAnalyzing ? 'Processing...' : 'Extract Images Only'}
          </button>
          
          <button
            onClick={handleAnalyze}
            disabled={!uploadedFileName || isAnalyzing || !config?.features?.vision_analysis}
            className="analysis-btn primary"
          >
            {isAnalyzing ? 'Analyzing...' : 'Full Vision Analysis'}
          </button>
        </div>
        
        {!config?.features?.vision_analysis && (
          <p className="warning">
            Full vision analysis requires OpenAI API key configuration
          </p>
        )}
        
        {analysisStatus && (
          <div className={`status-message ${analysisStatus.includes('failed') ? 'error' : 'success'}`}>
            {analysisStatus}
          </div>
        )}
      </div>

      {renderAnalysisResult()}
    </div>
  );
};

export default VisionTestPage;