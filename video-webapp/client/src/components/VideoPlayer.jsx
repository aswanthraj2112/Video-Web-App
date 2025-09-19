import React, { useMemo, useState } from 'react';
import api from '../api.js';

function VideoPlayer ({ video, token, onClose }) {
  const defaultVariant = video.status === 'ready' && video.transcodedFilename ? 'transcoded' : 'original';
  const [variant, setVariant] = useState(defaultVariant);

  const sourceUrl = useMemo(() => api.getStreamUrl(video.id, token, variant), [video.id, token, variant]);

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
                {video.transcodedFilename && (
                  <option value="transcoded">720p</option>
                )}
              </select>
            </label>
            <a className="btn-link" href={api.getStreamUrl(video.id, token, variant, true)}>
              Download current
            </a>
          </div>
          <video key={variant} className="video-player" controls src={sourceUrl} />
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
