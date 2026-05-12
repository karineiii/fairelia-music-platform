import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const audioRef = useRef(null);

  const [query, setQuery] = useState("lofi");
  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchMusic = async (searchQuery = query) => {
    try {
      setIsLoading(true);

      const response = await fetch(
        `http://localhost:5000/api/music/search?q=${encodeURIComponent(searchQuery)}`
      );

      const data = await response.json();
      setTracks(data.tracks || []);

      if (!currentTrack && data.tracks?.length > 0) {
        setCurrentTrack(data.tracks[0]);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    searchMusic("lofi");
  }, []);

  useEffect(() => {
    if (!currentTrack || !isPlaying || !audioRef.current) return;

    audioRef.current.load();

    audioRef.current.play().catch((error) => {
      console.error("Audio play failed:", error);
      setIsPlaying(false);
    });
  }, [currentTrack, isPlaying]);

  const playTrack = (track) => {
    console.log("Selected track:", track.title, track.streamUrl);

    setCurrentTrack(track);
    setIsPlaying(false);

    const audio = audioRef.current;

    if (!audio) {
      alert("Audio player not found");
      return;
    }

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    setTimeout(() => {
      audio.src = track.streamUrl;
      audio.load();

      const playWhenReady = async () => {
        try {
          await audio.play();
          setIsPlaying(true);
          setMessage(`Playing: ${track.title}`);
        } catch (error) {
          console.error("Audio play failed:", error);
          setMessage(`Could not play: ${error.name}`);
          alert(`Could not play this file: ${error.name}. Try another MP3 track.`);
          setIsPlaying(false);
        }
      };

      audio.addEventListener("canplay", playWhenReady, { once: true });
    }, 200);
  };

  const togglePlay = async () => {
    if (!currentTrack || !audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Toggle play failed:", error);
      alert("Could not play this song. Try another one.");
      setIsPlaying(false);
    }
  };

  return (
    <div className="page">
      <div className="stars">
        <span>★</span><span>✦</span><span>★</span><span>✧</span><span>★</span>
        <span>✦</span><span>★</span><span>✧</span><span>★</span><span>✦</span>
      </div>

      <div className="app-shell">
        <aside className="sidebar">
          <div className="logo-card">
            <div className="record">♪</div>
            <h1>Fairélia</h1>
            <p>Princess radio</p>
          </div>

          <nav>
            <a className="active">Browse</a>
            <a>Songs</a>
            <a>Albums</a>
            <a>Artists</a>
            <a>Radio</a>
          </nav>

          <div className="library">
            <h3>My music</h3>
            <a>Recently Played</a>
            <a>Favorite Songs</a>
            <a>Downloads</a>
          </div>
        </aside>

        <main className="content">
          <header className="topbar">
            <div>
              <p className="crumb">Archive.org › Public audio</p>
              <h2>Browse</h2>
            </div>

            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault();
                searchMusic(query);
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search real songs..."
              />
              <button type="submit">Search</button>
            </form>
          </header>

          <section className="feature">
            <div>
              <p className="tag">Now connected</p>
              <h3>Real Music Search</h3>
              <p>
                Fairélia is now playing public audio from Archive.org with a custom
                browser music player.
              </p>
              <button>{tracks.length} tracks found</button>
            </div>
            <div className="feature-art">💿</div>
          </section>

          <section>
            <div className="section-title">
              <h3>{isLoading ? "Searching..." : "Search results"}</h3>
              <a>Archive.org</a>
            </div>

            <div className="track-list">
              {tracks.map((track) => (
                <div className="track" key={track.streamUrl}>
                  <img className="mini-cover-img" src={track.coverUrl} alt={track.title} />
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                  <small>{track.duration ? `${Math.round(Number(track.duration))}s` : "--"}</small>
                  <button type="button" onClick={() => playTrack(track)}>▶</button>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="now-playing">
          <h3>Now Playing</h3>

          <div className="turntable">
            <div className="cover-card">
              {currentTrack?.coverUrl ? (
                <img src={currentTrack.coverUrl} alt={currentTrack.title} />
              ) : (
                <div className="cover-illustration">🌷</div>
              )}
              <div className="cover-text">
                <strong>{currentTrack?.title || "No song"}</strong>
                <span>{currentTrack?.source || "Fairélia"}</span>
              </div>
            </div>

            <div className={`vinyl ${isPlaying ? "spinning" : ""}`}>
              <div className="vinyl-ring ring-1"></div>
              <div className="vinyl-ring ring-2"></div>
              <div className="vinyl-label">
                <span>Fairélia</span>
              </div>
            </div>

            <div className={`tonearm ${isPlaying ? "active" : ""}`}></div>
          </div>

          <h4>{currentTrack?.title || "Choose a song"}</h4>
          <p>{currentTrack?.artist || "Search and play music"}</p>

          {currentTrack?.downloadUrl && (
            <a className="download-link" href={currentTrack.downloadUrl} target="_blank">
              Download / Open source file
            </a>
          )}

          <div className="queue">
            {tracks.slice(0, 4).map((track) => (
              <div className="queue-item" key={track.streamUrl}>
                <img src={track.coverUrl} alt={track.title} />
                <span>{track.title}</span>
                <button type="button" onClick={() => playTrack(track)}>▶</button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="player">
        <div className="player-song">
          {currentTrack?.coverUrl ? (
            <img className="mini-cover-img" src={currentTrack.coverUrl} alt={currentTrack.title} />
          ) : (
            <div className="mini-cover">♪</div>
          )}
          <div>
            <strong>{currentTrack?.title || "Nothing playing"}</strong>
            <p>{currentTrack?.artist || "Choose a song"}</p>
          </div>
        </div>

        <div className="controls">
          <button>⏮</button>
          <button type="button" className="play" onClick={togglePlay}>
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button>⏭</button>
        </div>

        <audio
          ref={audioRef}
          controls
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="wave">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>

        <small>{currentTrack?.source || "Fairélia"}</small>
      </footer>
    </div>
  );
}

export default App;
