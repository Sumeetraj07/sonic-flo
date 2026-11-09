// Reusable song recommendation engine and Apple Music preview importer
import { analyzeFile, type AnalyzedTrack } from "./audio-engine";

export interface SongRecommendation {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  primaryGenreName?: string;
}

// Fallback curated DJ bangers if uploaded files lack artist metadata
const CURATED_DJ_TRACKS: SongRecommendation[] = [
  {
    trackId: 1440857781,
    trackName: "One Kiss",
    artistName: "Calvin Harris & Dua Lipa",
    collectionName: "One Kiss - Single",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/09/25/73/09257321-df62-ea9e-b9e9-11f81ceefdf2/886447012354.jpg/100x100bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/33/23/04/33230491-b4f7-e76e-519e-e374ff72ff17/mzaf_1057484649774643037.plus.aac.p.m4a",
    primaryGenreName: "Dance",
  },
  {
    trackId: 1440854496,
    trackName: "Pepas",
    artistName: "Farruko",
    collectionName: "La 167",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/eb/b2/a2/ebb2a24c-9f6b-1f8a-9285-d85c8e31ba19/886449495766.jpg/100x100bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a4/09/be/a409be44-a006-2581-c75c-3a316885dfb2/mzaf_7824147772879555132.plus.aac.p.m4a",
    primaryGenreName: "Latin Urban",
  },
  {
    trackId: 1440783617,
    trackName: "Titanium (feat. Sia)",
    artistName: "David Guetta",
    collectionName: "Nothing but the Beat",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e5/22/02/e5220268-3081-332e-5f93-c97693cf7584/5099908389552.jpg/100x100bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/37/b8/b5/37b8b54b-b054-d9ee-5645-095cfd9cce54/mzaf_15086036136208696884.plus.aac.p.m4a",
    primaryGenreName: "Dance",
  },
  {
    trackId: 1576202456,
    trackName: "Stay",
    artistName: "The Kid LAROI & Justin Bieber",
    collectionName: "F*CK LOVE 3+: OVER YOU",
    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d5/43/d3/d543d357-e630-f947-f559-fb3d30b62e43/886449487921.jpg/100x100bb.jpg",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/58/fc/2f/58fc2f3a-cefa-f327-e1ec-3a3b3fa5c155/mzaf_17205831526685412502.plus.aac.p.m4a",
    primaryGenreName: "Pop",
  },
];

// Extract clean artist names and song queries from track filenames
export function extractArtistAndTitle(name: string): { artist: string; title: string; query: string } {
  // Common separator patterns: "Artist - Title", "Title - Artist"
  const cleanName = name.replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/i, "").trim();
  
  if (cleanName.includes(" - ")) {
    const parts = cleanName.split(" - ");
    const part0 = parts[0].trim();
    const part1 = parts.slice(1).join(" - ").trim();
    // Usually "Title - Artist" or "Artist - Title"
    return {
      artist: part1.split("&")[0].split("feat")[0].split("ft")[0].trim(),
      title: part0,
      query: `${part0} ${part1}`,
    };
  }

  // Split on " by "
  if (cleanName.toLowerCase().includes(" by ")) {
    const parts = cleanName.split(/ by /i);
    return {
      artist: parts[1].trim(),
      title: parts[0].trim(),
      query: cleanName,
    };
  }

  return {
    artist: "",
    title: cleanName,
    query: cleanName,
  };
}

export async function fetchRecommendationsForTracks(
  tracks: AnalyzedTrack[]
): Promise<SongRecommendation[]> {
  if (tracks.length === 0) return [];

  const existingTrackNames = new Set(
    tracks.map((t) => t.name.toLowerCase().replace(/[^a-z0-9]/g, ""))
  );

  // Extract distinct artists and titles from selected tracks
  const searchTerms: string[] = [];
  const artistsFound = new Set<string>();

  for (const track of tracks) {
    const { artist, title, query } = extractArtistAndTitle(track.name);
    if (artist && artist.length > 2 && !artistsFound.has(artist.toLowerCase())) {
      artistsFound.add(artist.toLowerCase());
      searchTerms.push(artist);
    }
    if (title && title.length > 2) {
      searchTerms.push(query);
    }
  }

  // Prioritize top 4 search terms
  const termsToQuery = [...new Set(searchTerms)].slice(0, 4);

  try {
    const fetchPromises = termsToQuery.map(async (term) => {
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=15`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []) as SongRecommendation[];
      } catch (e) {
        return [];
      }
    });

    const resultsArray = await Promise.all(fetchPromises);
    const candidateMap = new Map<number, { song: SongRecommendation; score: number }>();

    for (const songList of resultsArray) {
      for (const song of songList) {
        if (!song.trackId || !song.previewUrl) continue;

        const normalizedSong = `${song.trackName} ${song.artistName}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normalizedTitle = song.trackName.toLowerCase().replace(/[^a-z0-9]/g, "");

        // Exclude if already selected in user tracks
        let alreadySelected = false;
        for (const existing of existingTrackNames) {
          if (existing && (normalizedSong.includes(existing) || existing.includes(normalizedTitle))) {
            alreadySelected = true;
            break;
          }
        }
        if (alreadySelected) continue;

        // Boost score if artist matches one of the user's selected artists
        let bonus = 1;
        for (const userArtist of artistsFound) {
          if (song.artistName.toLowerCase().includes(userArtist)) {
            bonus += 3;
            break;
          }
        }

        const existingCandidate = candidateMap.get(song.trackId);
        candidateMap.set(song.trackId, {
          song,
          score: (existingCandidate?.score || 0) + bonus,
        });
      }
    }

    const sortedRecommendations = [...candidateMap.values()]
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.song)
      .slice(0, 8);

    if (sortedRecommendations.length > 0) {
      return sortedRecommendations;
    }
  } catch (err) {
    console.error("Error fetching song recommendations:", err);
  }

  // Fallback to curated tracks if search returns empty
  return CURATED_DJ_TRACKS.filter((song) => {
    const norm = song.trackName.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const existing of existingTrackNames) {
      if (existing.includes(norm)) return false;
    }
    return true;
  }).slice(0, 4);
}

// Downloads preview audio and returns AnalyzedTrack ready for mixing
export async function importTrackFromPreview(
  track: SongRecommendation
): Promise<AnalyzedTrack> {
  if (!track.previewUrl) {
    throw new Error("No preview URL available for this song.");
  }

  let res: Response;
  try {
    res = await fetch(track.previewUrl);
    if (!res.ok) throw new Error(`Direct fetch failed with status ${res.status}`);
  } catch (err) {
    // Fallback via CORS proxy
    res = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(track.previewUrl)}`
    );
  }

  const blob = await res.blob();
  if (blob.type.includes("text/html")) {
    throw new Error("Could not download audio preview: received HTML response.");
  }

  const filename = `${track.trackName} - ${track.artistName}.m4a`;
  const file = new File([blob], filename, { type: "audio/mp4" });
  return await analyzeFile(file);
}
