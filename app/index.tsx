import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  PressStart2P_400Regular,
  useFonts,
} from "@expo-google-fonts/press-start-2p";

const API_URL = "http://192.168.1.6:5000";
const LIKED_KEY = "fairelia_liked_tracks";

type Track = {
  id: string;
  title: string;
  artist: string;
  source: string;
  streamUrl?: string;
  downloadUrl?: string;
  coverUrl: string;
};

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
  });

  const [query, setQuery] = useState("Rosé");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingLoading, setPlayingLoading] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playRequestIdRef = useRef(0);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(1);

  const [likedTracks, setLikedTracks] = useState<Track[]>([]);

  const featuredTracks = useMemo(() => tracks.slice(0, 6), [tracks]);
  const favoritePreview = useMemo(() => likedTracks.slice(0, 4), [likedTracks]);

  useEffect(() => {
    loadLikedTracks();

    return () => {
      playRequestIdRef.current += 1;

      const sound = soundRef.current;
      if (sound) {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
      }

      soundRef.current = null;
    };
  }, []);

  const loadLikedTracks = async () => {
    try {
      const saved = await AsyncStorage.getItem(LIKED_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setLikedTracks(parsed);
        }
      }
    } catch (error) {
      console.log("Failed to load liked tracks:", error);
    }
  };

  const saveLikedTracks = async (nextLikedTracks: Track[]) => {
    setLikedTracks(nextLikedTracks);
    await AsyncStorage.setItem(LIKED_KEY, JSON.stringify(nextLikedTracks));
  };

  const isLiked = (track: Track) => {
    return likedTracks.some(
      (item) => item.id === track.id && item.source === track.source
    );
  };

  const toggleLike = async (track: Track) => {
    try {
      const nextLikedTracks = isLiked(track)
        ? likedTracks.filter(
            (item) => !(item.id === track.id && item.source === track.source)
          )
        : [track, ...likedTracks];

      await saveLikedTracks(nextLikedTracks);
    } catch (error) {
      Alert.alert("Like error", String(error));
    }
  };

  const normalizeStreamUrl = (url: string) => {
    return String(url)
      .replace("http://localhost:5000", API_URL)
      .replace("http://127.0.0.1:5000", API_URL);
  };

  const searchMusic = async () => {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      Alert.alert("Search", "Write something to search.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/music/search?q=${encodeURIComponent(cleanQuery)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Search failed");
      }

      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (error) {
      Alert.alert(
        "Search error",
        "Could not search right now. Check backend and Wi-Fi."
      );
      console.log("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPlayableUrl = async (track: Track) => {
    if (track.streamUrl && track.streamUrl.length > 5) {
      return normalizeStreamUrl(track.streamUrl);
    }

    const response = await fetch(
      `${API_URL}/api/music/stream?source=${encodeURIComponent(
        track.source
      )}&id=${encodeURIComponent(track.id)}&title=${encodeURIComponent(
        track.title
      )}&artist=${encodeURIComponent(track.artist)}`
    );

    const data = await response.json();

    if (!response.ok || !data.streamUrl) {
      throw new Error(data?.error || data?.message || "No stream URL returned");
    }

    const finalUrl = normalizeStreamUrl(data.streamUrl);

    console.log("PLAY URL:", finalUrl);

    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      throw new Error(`Invalid stream URL: ${finalUrl}`);
    }

    return finalUrl;
  };

  const playTrack = async (track: Track) => {
    const requestId = playRequestIdRef.current + 1;
    playRequestIdRef.current = requestId;

    try {
      setPlayingLoading(true);

      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setCurrentTrack(track);
      setIsPlaying(false);
      setPositionMillis(0);
      setDurationMillis(1);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const playableUrl = await getPlayableUrl(track);

      if (playRequestIdRef.current !== requestId) {
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: playableUrl },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 500,
        }
      );

      if (playRequestIdRef.current !== requestId) {
        await newSound.unloadAsync().catch(() => {});
        return;
      }

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (playRequestIdRef.current !== requestId) return;
        if (!status.isLoaded) return;

        setIsPlaying(status.isPlaying);
        setPositionMillis(status.positionMillis || 0);
        setDurationMillis(status.durationMillis || 1);

        if (status.didJustFinish) {
          setIsPlaying(false);
          setPositionMillis(0);
        }
      });

      soundRef.current = newSound;
      await newSound.playAsync();

      if (playRequestIdRef.current === requestId) {
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("Play error:", error);

      Alert.alert(
        "Play error",
        "This track could not play. Try another result or search another song."
      );

      setIsPlaying(false);
      setCurrentTrack(null);
      setPositionMillis(0);
      setDurationMillis(1);
    } finally {
      if (playRequestIdRef.current === requestId) {
        setPlayingLoading(false);
      }
    }
  };

  const togglePlayPause = async () => {
    const sound = soundRef.current;
    if (!sound) return;

    try {
      const status = await sound.getStatusAsync();

      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      Alert.alert("Player error", String(error));
    }
  };

  const stopTrack = async () => {
    playRequestIdRef.current += 1;

    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setCurrentTrack(null);
      setIsPlaying(false);
      setPlayingLoading(false);
      setPositionMillis(0);
      setDurationMillis(1);
    } catch (error) {
      Alert.alert("Stop error", String(error));
    }
  };

  const playPrevious = async () => {
    if (!currentTrack || tracks.length === 0) return;

    const currentIndex = tracks.findIndex(
      (item) => item.id === currentTrack.id && item.source === currentTrack.source
    );

    const previousIndex =
      currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;

    await playTrack(tracks[previousIndex]);
  };

  const playNext = async () => {
    if (!currentTrack || tracks.length === 0) return;

    const currentIndex = tracks.findIndex(
      (item) => item.id === currentTrack.id && item.source === currentTrack.source
    );

    const nextIndex =
      currentIndex === -1 || currentIndex >= tracks.length - 1
        ? 0
        : currentIndex + 1;

    await playTrack(tracks[nextIndex]);
  };

  const handleTrackPress = async (track: Track) => {
    const active =
      currentTrack?.id === track.id && currentTrack?.source === track.source;

    if (active && soundRef.current) {
      await togglePlayPause();
      return;
    }

    await playTrack(track);
  };

  const progress = Math.min(positionMillis / durationMillis, 1);

  const formatTime = (millis: number) => {
    const safeMillis = Number.isFinite(millis) ? millis : 0;
    const totalSeconds = Math.floor(safeMillis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const emptyCover =
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=900";

  const heroCover = currentTrack?.coverUrl || featuredTracks[0]?.coverUrl || emptyCover;

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderPage}>
        <Text style={styles.loaderTitle}>FAIRÉLIA</Text>
        <ActivityIndicator color="#63FBD7" size="large" />
        <Text style={styles.loaderText}>LOADING RETRO UI...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.logo}>FAIRÉLIA</Text>
            <Text style={styles.subtitle}>ARCADE MUSIC CONSOLE</Text>
          </View>

          <View style={styles.pixelBadge}>
            <Text style={styles.pixelBadgeText}>ON</Text>
          </View>
        </View>

        <View style={styles.searchPanel}>
          <Text style={styles.panelLabel}>SEARCH TERMINAL</Text>

          <View style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="TYPE SONG OR ARTIST"
              placeholderTextColor="#6D7E77"
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={searchMusic}
            />

            <Pressable
              style={[styles.searchButton, loading && styles.disabledButton]}
              onPress={searchMusic}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0A0F0D" />
              ) : (
                <Text style={styles.searchText}>GO</Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.tabRow}>
          <View style={styles.tabChipActive}>
            <Text style={styles.tabChipActiveText}>DISCOVER</Text>
          </View>

          <View style={styles.tabChip}>
            <Text style={styles.tabChipText}>FAVORITES</Text>
          </View>

          <View style={styles.tabChip}>
            <Text style={styles.tabChipText}>RESULTS</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Image source={{ uri: heroCover }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />

          <View style={styles.heroTop}>
            <View style={styles.livePanel}>
              <Text style={styles.livePanelText}>LIVE SIGNAL</Text>
            </View>

            <View style={styles.levelPanel}>
              <Text style={styles.levelPanelText}>AUDIO 01</Text>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <Text style={styles.heroMain}>
              {currentTrack ? "NOW PLAYING" : "RETRO STREAM"}
            </Text>

            <Text style={styles.heroSub} numberOfLines={2}>
              {currentTrack
                ? `${currentTrack.title} — ${currentTrack.artist}`
                : "SEARCH TRACKS, SAVE FAVORITES, AND PLAY YOUR MUSIC IN A FULL RETRO MODE."}
            </Text>
          </View>
        </View>

        {currentTrack && (
          <View style={styles.playerCard}>
            <View style={styles.playerTop}>
              <Text style={styles.playerTopText}>PLAYER DECK</Text>
              <Text style={styles.playerTopSource}>
                {currentTrack.source.toUpperCase()}
              </Text>
            </View>

            <View style={styles.playerMain}>
              <Image
                source={{ uri: currentTrack.coverUrl || emptyCover }}
                style={styles.playerCover}
              />

              <View style={styles.playerInfo}>
                <Text style={styles.playerTitle} numberOfLines={2}>
                  {currentTrack.title}
                </Text>

                <Text style={styles.playerArtist} numberOfLines={2}>
                  {currentTrack.artist}
                </Text>

                <View style={styles.progressWrap}>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={Math.max(durationMillis, 1)}
                    value={Math.min(positionMillis, durationMillis)}
                    minimumTrackTintColor="#63FBD7"
                    maximumTrackTintColor="#24372F"
                    thumbTintColor="#F7D76A"
                    disabled={!soundRef.current || durationMillis <= 1}
                    onSlidingComplete={async (value) => {
                      try {
                        const sound = soundRef.current;
                        if (!sound) return;

                        await sound.setPositionAsync(value);
                        setPositionMillis(value);
                      } catch (error) {
                        console.log("Seek error:", error);
                      }
                    }}
                  />

                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>
                      {formatTime(positionMillis)}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatTime(durationMillis)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.controlRow}>
              <Pressable style={styles.controlButton} onPress={playPrevious}>
                <Text style={styles.controlButtonText}>PREV</Text>
              </Pressable>

              <Pressable
                style={styles.controlButtonBig}
                onPress={togglePlayPause}
                disabled={playingLoading}
              >
                {playingLoading ? (
                  <ActivityIndicator color="#0A0F0D" />
                ) : (
                  <Text style={styles.controlButtonBigText}>
                    {isPlaying ? "PAUSE" : "PLAY"}
                  </Text>
                )}
              </Pressable>

              <Pressable style={styles.controlButton} onPress={playNext}>
                <Text style={styles.controlButtonText}>NEXT</Text>
              </Pressable>
            </View>

            <View style={styles.secondaryRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => toggleLike(currentTrack)}
              >
                <Text style={styles.secondaryButtonText}>
                  {isLiked(currentTrack) ? "UNLIKE" : "LIKE"}
                </Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={stopTrack}>
                <Text style={styles.secondaryButtonText}>STOP</Text>
              </Pressable>
            </View>
          </View>
        )}

        {featuredTracks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TOP PICKS</Text>
              <Text style={styles.sectionInfo}>SELECT</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}
            >
              {featuredTracks.map((track, index) => {
                const active =
                  currentTrack?.id === track.id &&
                  currentTrack?.source === track.source;

                return (
                  <Pressable
                    key={`featured-${track.source}-${track.id}-${index}`}
                    style={[
                      styles.featuredCard,
                      active && styles.featuredCardActive,
                    ]}
                    onPress={() => handleTrackPress(track)}
                  >
                    <Image
                      source={{ uri: track.coverUrl || emptyCover }}
                      style={styles.featuredImage}
                    />

                    <Text style={styles.featuredTitle} numberOfLines={2}>
                      {track.title}
                    </Text>

                    <Text style={styles.featuredArtist} numberOfLines={2}>
                      {track.artist}
                    </Text>

                    <View style={styles.featuredFooter}>
                      <Text style={styles.featuredSource}>
                        {track.source.toUpperCase()}
                      </Text>

                      <View style={styles.featuredAction}>
                        <Text style={styles.featuredActionText}>
                          {active && isPlaying ? "II" : ">"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {favoritePreview.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FAVORITES</Text>
              <Text style={styles.sectionInfo}>{likedTracks.length} SAVED</Text>
            </View>

            <View style={styles.favoritePanel}>
              {favoritePreview.map((track, index) => (
                <Pressable
                  key={`favorite-${track.source}-${track.id}-${index}`}
                  style={styles.favoriteItem}
                  onPress={() => handleTrackPress(track)}
                >
                  <Image
                    source={{ uri: track.coverUrl || emptyCover }}
                    style={styles.favoriteCover}
                  />

                  <View style={styles.favoriteTextWrap}>
                    <Text style={styles.favoriteTitle} numberOfLines={2}>
                      {track.title}
                    </Text>

                    <Text style={styles.favoriteArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>

                  <Text style={styles.favoriteLike}>♥</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {tracks.length > 0 ? `${tracks.length} RESULTS` : "SEARCH RESULTS"}
          </Text>

          {loading && <Text style={styles.sectionInfo}>LOADING</Text>}
        </View>

        {tracks.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>NO TRACKS YET</Text>
            <Text style={styles.emptyText}>
              TRY SEARCHING ROSÉ, BRUNO MARS, LANA DEL REY OR ANY ARTIST.
            </Text>
          </View>
        )}

        {tracks.map((track, index) => {
          const active =
            currentTrack?.id === track.id &&
            currentTrack?.source === track.source;

          return (
            <View
              style={[styles.songCard, active && styles.activeSongCard]}
              key={`${track.source}-${track.id}-${index}`}
            >
              <Image
                source={{ uri: track.coverUrl || emptyCover }}
                style={styles.cover}
              />

              <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={2}>
                  {track.title}
                </Text>

                <Text style={styles.songArtist} numberOfLines={1}>
                  {track.artist}
                </Text>

                <Text style={styles.source}>{track.source.toUpperCase()}</Text>
              </View>

              <Pressable
                style={styles.likeButton}
                onPress={() => toggleLike(track)}
              >
                <Text style={styles.likeText}>{isLiked(track) ? "♥" : "+"}</Text>
              </Pressable>

              <Pressable
                style={[styles.playButton, active && styles.activePlayButton]}
                onPress={() => handleTrackPress(track)}
                disabled={playingLoading && !active}
              >
                {playingLoading && active ? (
                  <ActivityIndicator color="#0A0F0D" size="small" />
                ) : (
                  <Text style={styles.playText}>
                    {active && isPlaying ? "II" : ">"}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#090E0C",
  },
  page: {
    flex: 1,
    backgroundColor: "#090E0C",
  },
  content: {
    padding: 18,
    paddingTop: 58,
    paddingBottom: 80,
  },

  loaderPage: {
    flex: 1,
    backgroundColor: "#090E0C",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loaderTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 24,
    marginBottom: 22,
    textAlign: "center",
  },
  loaderText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 10,
    marginTop: 20,
    textAlign: "center",
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  logo: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 9,
    marginTop: 8,
    lineHeight: 15,
  },
  pixelBadge: {
    minWidth: 58,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#C8FF5A",
    borderWidth: 3,
    borderColor: "#142019",
    alignItems: "center",
    justifyContent: "center",
  },
  pixelBadgeText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#0A0F0D",
    fontSize: 8,
  },

  searchPanel: {
    backgroundColor: "#131B17",
    borderWidth: 3,
    borderColor: "#2A3932",
    padding: 14,
    marginBottom: 14,
  },
  panelLabel: {
    fontFamily: "PressStart2P_400Regular",
    color: "#9AB4A7",
    fontSize: 8,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 54,
    backgroundColor: "#09110D",
    borderWidth: 3,
    borderColor: "#294037",
    color: "#E9FFF7",
    paddingHorizontal: 14,
    fontFamily: "PressStart2P_400Regular",
    fontSize: 9,
    lineHeight: 14,
    marginRight: 10,
  },
  searchButton: {
    minWidth: 78,
    minHeight: 54,
    backgroundColor: "#63FBD7",
    borderWidth: 3,
    borderColor: "#1D2D29",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.7,
  },
  searchText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#0A0F0D",
    fontSize: 10,
  },

  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  tabChipActive: {
    backgroundColor: "#C8FF5A",
    borderWidth: 2,
    borderColor: "#1D2B22",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  tabChip: {
    backgroundColor: "#18231E",
    borderWidth: 2,
    borderColor: "#2B3C34",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  tabChipActiveText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#0A0F0D",
    fontSize: 8,
  },
  tabChipText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#8EA89B",
    fontSize: 8,
  },

  heroCard: {
    height: 230,
    backgroundColor: "#101714",
    borderWidth: 3,
    borderColor: "#2A3932",
    overflow: "hidden",
    padding: 14,
    marginBottom: 18,
    justifyContent: "space-between",
  },
  heroImage: {
    position: "absolute",
    width: "110%",
    height: "110%",
    top: "-5%",
    left: "-5%",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(5,10,9,0.56)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  livePanel: {
    backgroundColor: "#0A0F0D",
    borderWidth: 2,
    borderColor: "#63FBD7",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  livePanelText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 7,
  },
  levelPanel: {
    backgroundColor: "#0A0F0D",
    borderWidth: 2,
    borderColor: "#F7D76A",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  levelPanelText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 7,
  },
  heroBottom: {},
  heroMain: {
    fontFamily: "PressStart2P_400Regular",
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 10,
  },
  heroSub: {
    fontFamily: "PressStart2P_400Regular",
    color: "#DDF7EE",
    fontSize: 9,
    lineHeight: 16,
  },

  playerCard: {
    backgroundColor: "#121A16",
    borderWidth: 3,
    borderColor: "#3B5146",
    padding: 14,
    marginBottom: 18,
  },
  playerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  playerTopText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 8,
  },
  playerTopSource: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 8,
  },
  playerMain: {
    flexDirection: "row",
    marginBottom: 14,
  },
  playerCover: {
    width: 110,
    height: 110,
    borderWidth: 3,
    borderColor: "#2B3A34",
    backgroundColor: "#0B100E",
    marginRight: 12,
  },
  playerInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  playerTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 18,
  },
  playerArtist: {
    fontFamily: "PressStart2P_400Regular",
    color: "#96B2A4",
    fontSize: 8,
    lineHeight: 14,
    marginTop: 8,
  },
  progressWrap: {
    marginTop: 12,
  },
  slider: {
    width: "100%",
    height: 34,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 7,
  },

  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  controlButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#18231E",
    borderWidth: 2,
    borderColor: "#32453B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  controlButtonBig: {
    flex: 1.2,
    minHeight: 48,
    backgroundColor: "#C8FF5A",
    borderWidth: 2,
    borderColor: "#27321F",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  controlButtonText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#E5FFF5",
    fontSize: 8,
  },
  controlButtonBigText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#0A0F0D",
    fontSize: 8,
  },

  secondaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: "#0B100E",
    borderWidth: 2,
    borderColor: "#2C3D36",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  secondaryButtonText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 8,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
    marginRight: 10,
  },
  sectionInfo: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 8,
  },

  featuredRow: {
    paddingRight: 12,
    paddingBottom: 8,
  },
  featuredCard: {
    width: 180,
    backgroundColor: "#121A16",
    borderWidth: 3,
    borderColor: "#2C3D36",
    padding: 10,
    marginRight: 12,
  },
  featuredCardActive: {
    borderColor: "#63FBD7",
  },
  featuredImage: {
    width: "100%",
    height: 118,
    backgroundColor: "#0A0F0D",
    borderWidth: 2,
    borderColor: "#2B3A34",
    marginBottom: 10,
  },
  featuredTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F4FFF9",
    fontSize: 8,
    lineHeight: 14,
    minHeight: 30,
  },
  featuredArtist: {
    fontFamily: "PressStart2P_400Regular",
    color: "#90AA9D",
    fontSize: 7,
    lineHeight: 12,
    marginTop: 6,
    minHeight: 24,
  },
  featuredFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  featuredSource: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 7,
    flex: 1,
    marginRight: 8,
  },
  featuredAction: {
    width: 34,
    height: 34,
    backgroundColor: "#63FBD7",
    borderWidth: 2,
    borderColor: "#1C2A26",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredActionText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#0A0F0D",
    fontSize: 10,
  },

  favoritePanel: {
    backgroundColor: "#121A16",
    borderWidth: 3,
    borderColor: "#2B3C34",
    padding: 10,
    marginBottom: 18,
  },
  favoriteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E1512",
    borderWidth: 2,
    borderColor: "#223129",
    padding: 8,
    marginBottom: 8,
  },
  favoriteCover: {
    width: 54,
    height: 54,
    borderWidth: 2,
    borderColor: "#30423A",
    backgroundColor: "#09110D",
    marginRight: 10,
  },
  favoriteTextWrap: {
    flex: 1,
  },
  favoriteTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F2FFF8",
    fontSize: 8,
    lineHeight: 14,
  },
  favoriteArtist: {
    fontFamily: "PressStart2P_400Regular",
    color: "#8AA397",
    fontSize: 7,
    lineHeight: 12,
    marginTop: 6,
  },
  favoriteLike: {
    fontFamily: "PressStart2P_400Regular",
    color: "#C8FF5A",
    fontSize: 12,
    marginLeft: 8,
  },

  emptyBox: {
    backgroundColor: "#121A16",
    borderWidth: 3,
    borderColor: "#2B3C34",
    padding: 18,
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#63FBD7",
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#A2BBB0",
    fontSize: 8,
    lineHeight: 15,
  },

  songCard: {
    backgroundColor: "#121A16",
    borderWidth: 3,
    borderColor: "#2C3D36",
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  activeSongCard: {
    borderColor: "#63FBD7",
    backgroundColor: "#17211C",
  },
  cover: {
    width: 62,
    height: 62,
    borderWidth: 2,
    borderColor: "#30423A",
    backgroundColor: "#0B100E",
    marginRight: 10,
  },
  songInfo: {
    flex: 1,
    paddingRight: 8,
  },
  songTitle: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F4FFF9",
    fontSize: 8,
    lineHeight: 14,
  },
  songArtist: {
    fontFamily: "PressStart2P_400Regular",
    color: "#8CA59A",
    fontSize: 7,
    lineHeight: 12,
    marginTop: 6,
  },
  source: {
    fontFamily: "PressStart2P_400Regular",
    color: "#F7D76A",
    fontSize: 7,
    marginTop: 6,
  },

  likeButton: {
    width: 42,
    height: 42,
    backgroundColor: "#192420",
    borderWidth: 2,
    borderColor: "#30423A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  likeText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#C8FF5A",
    fontSize: 10,
  },

  playButton: {
    width: 48,
    height: 48,
    backgroundColor: "#63FBD7",
    borderWidth: 2,
    borderColor: "#1A2924",
    alignItems: "center",
    justifyContent: "center",
  },
  activePlayButton: {
    backgroundColor: "#F7D76A",
  },
  playText: {
    fontFamily: "PressStart2P_400Regular",
    color: "#0A0F0D",
    fontSize: 12,
  },
});