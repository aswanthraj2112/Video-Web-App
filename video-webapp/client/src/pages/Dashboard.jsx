import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { useToast } from '../App.jsx';
import Uploader from '../components/Uploader.jsx';
import VideoList from '../components/VideoList.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';

function Dashboard ({ token, user }) {
  const notify = useToast();
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listVideos(token, page, limit)
      .then((data) => {
        if (!cancelled) {
          setVideos(data.items || []);
          setTotal(data.total || 0);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          notify(error.message, 'error');
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
  }, [token, page, limit, notify, refreshIndex]);

  useEffect(() => {
    if (!selectedVideo) return;
    let cancelled = false;
    api
      .getVideo(token, selectedVideo.id)
      .then(({ video: fresh }) => {
        if (!cancelled) {
          setSelectedVideo(fresh);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedVideo, refreshIndex]);

  const triggerRefresh = () => setRefreshIndex((value) => value + 1);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      await api.uploadVideo(token, file);
      notify(`Uploaded ${file.name}`, 'success');
      setPage(1);
      triggerRefresh();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSelect = async (video) => {
    try {
      const { video: fresh } = await api.getVideo(token, video.id);
      setSelectedVideo(fresh);
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const handleTranscode = async (video) => {
    try {
      await api.requestTranscode(token, video.id, '720p');
      notify('Transcode started', 'info');
      triggerRefresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const handleDelete = async (video) => {
    if (!window.confirm(`Delete ${video.originalName}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteVideo(token, video.id);
      notify('Video deleted', 'info');
      if (selectedVideo?.id === video.id) {
        setSelectedVideo(null);
      }
      triggerRefresh();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const handleDownload = async (video, variant) => {
    try {
      const { url } = await api.getPresignedUrl(token, video.id, { variant, download: true });
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  return (
    <div className="dashboard">
      <section className="welcome">
        <h1>Hello, {user.username || 'there'}!</h1>
        <p>Upload a video to generate thumbnails, kick off a 720p transcode, and stream directly from the browser.</p>
      </section>
      <Uploader onUpload={handleUpload} uploading={uploading} />
      <VideoList
        videos={videos}
        loading={loading}
        page={page}
        limit={limit}
        total={total}
        onSelect={handleSelect}
        onTranscode={handleTranscode}
        onDelete={handleDelete}
        onPageChange={setPage}
        onDownload={handleDownload}
      />
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          token={token}
          onClose={() => setSelectedVideo(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

export default Dashboard;
