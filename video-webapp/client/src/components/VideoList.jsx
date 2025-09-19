import React from 'react';
import api from '../api.js';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return 'Unknown';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [m.toString().padStart(2, '0'), s.toString().padStart(2, '0')];
  if (h > 0) {
    parts.unshift(h.toString());
  }
  return parts.join(':');
};

function VideoList ({
  videos,
  token,
  loading,
  page,
  limit,
  total,
  onSelect,
  onTranscode,
  onDelete,
  onPageChange
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  return (
    <section className="video-list">
      <header className="section-header">
        <h2>Your videos</h2>
        <div className="pagination">
          <button type="button" className="btn" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            Previous
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button type="button" className="btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
            Next
          </button>
        </div>
      </header>

      {loading ? (
        <p>Loading videos…</p>
      ) : videos.length === 0 ? (
        <p>No uploads yet. Drop a file above to get started!</p>
      ) : (
        <ul className="video-grid">
          {videos.map((video) => (
            <li key={video.id} className="video-card">
              <div className="thumb-wrapper">
                <img
                  src={api.getThumbnailUrl(video.id, token)}
                  alt={`${video.originalName} thumbnail`}
                  onError={(event) => {
                    event.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiNFMEUwRTAiIHJ4PSIxMiIvPjx0ZXh0IHg9IjYwIiB5PSI0OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5Ij5ObyBUaHVtYjwvdGV4dD48L3N2Zz4=';
                  }}
                />
              </div>
              <div className="video-info">
                <h3 title={video.originalName}>{video.originalName}</h3>
                <p>Duration: {formatDuration(video.durationSec)}</p>
                <p>
                  Status: <span className={`status status-${video.status}`}>{video.status}</span>
                </p>
                <p>Size: {formatBytes(video.sizeBytes)}</p>
                <p>Uploaded: {new Date(video.createdAt).toLocaleString()}</p>
              </div>
              <div className="video-actions">
                <button type="button" className="btn" onClick={() => onSelect(video)}>
                  Play
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={video.status === 'transcoding'}
                  onClick={() => onTranscode(video)}
                >
                  Transcode 720p
                </button>
                <a className="btn-link" href={api.getStreamUrl(video.id, token, 'original', true)}>
                  Download original
                </a>
                {video.transcodedFilename && video.status === 'ready' && (
                  <a className="btn-link" href={api.getStreamUrl(video.id, token, 'transcoded', true)}>
                    Download 720p
                  </a>
                )}
                <button type="button" className="btn btn-danger" onClick={() => onDelete(video)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default VideoList;
