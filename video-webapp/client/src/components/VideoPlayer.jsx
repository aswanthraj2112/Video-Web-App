import React, { useEffect, useMemo, useState } from 'react';
import api from '../api.js';

function VideoPlayer ({ video, token, onClose, onDownload }) {
  const defaultVariant = video.status === 'ready' && (video.transcodedFilename || video.transcodedKey)
    ? 'transcoded'
    : 'original';
  const [variant, setVariant] = useState(defaultVariant);
  const [sourceUrl, setSourceUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSourceUrl('');

    api
      .getPresignedUrl(token, video.id, { variant, download: false })
      .then(({ url }) => {
        if (!cancelled) {
          setSourceUrl(url);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, video.id, variant]);

  useEffect(() => {
    setVariant(defaultVariant);
  }, [defaultVariant]);

  const canDownloadTranscoded = useMemo(
    () => Boolean(video.transcodedFilename || video.transcodedKey),
    [video.transcodedFilename, video.transcodedKey]
  );

  return (
    <div className="player-backdrop" onClick={onClose}>
      <div className="player" onClick={(event) => event.stopPropagation()}>
        <header className="player-header">
          <h3>{video.originalName}</h3>
          <button type="button" className="btn btn-danger" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="player-body">
          <div className="player-controls">
            <label>
              Quality:
              <select value={variant} onChange={(event) => setVariant(event.target.value)}>
                <option value="original">Original</option>
                {canDownloadTranscoded && (
                  <option value="transcoded">720p</option>
                )}
              </select>
            </label>
            <button
              type="button"
              className="btn-link"
              onClick={() => onDownload(video, variant)}
            >
              Download current
            </button>
          </div>
          {loading && <p>Generating stream URL…</p>}
          {error && <p className="error">{error}</p>}
          {!loading && !error && sourceUrl && (
            <video key={sourceUrl} className="video-player" controls src={sourceUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
