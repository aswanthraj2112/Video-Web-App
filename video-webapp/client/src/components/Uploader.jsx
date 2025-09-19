import React, { useCallback, useRef, useState } from 'react';

function Uploader ({ onUpload, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    const [file] = fileList || [];
    if (file) {
      onUpload(file);
    }
  }, [onUpload]);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!dragging) {
      setDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragging(false);
  };

  const triggerFilePicker = () => {
    inputRef.current?.click();
  };

  const onInputChange = (event) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  return (
    <div
      className={`uploader ${dragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFilePicker}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden-input"
        onChange={onInputChange}
        disabled={uploading}
      />
      <p>{uploading ? 'Uploading…' : 'Drag & drop a video here or click to browse'}</p>
    </div>
  );
}

export default Uploader;
