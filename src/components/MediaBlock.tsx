import { Box, Button } from '@mui/material';
import PlayIcon from '@mui/icons-material/SmartDisplay';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import { useState } from 'react';

/**
 * Shows a local illustration when available; otherwise a calm placeholder plus
 * a "watch a demo" button that opens a curated YouTube search (the plan's
 * deliberate choice — no unverified embedded URLs, works offline as text).
 */
export default function MediaBlock({
  imageUrl,
  videoUrl,
  alt,
  height = 190,
}: {
  imageUrl: string | null;
  videoUrl: string | null;
  alt: string;
  height?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = imageUrl && !imgFailed;

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 3,
        overflow: 'hidden',
        height,
        bgcolor: 'rgba(63,125,99,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={alt}
          onError={() => setImgFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <SelfImprovementIcon sx={{ fontSize: 64, color: 'primary.light', opacity: 0.55 }} />
      )}

      {videoUrl && (
        <Button
          component="a"
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="contained"
          startIcon={<PlayIcon />}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            bgcolor: 'rgba(32,48,42,0.82)',
            '&:hover': { bgcolor: 'rgba(32,48,42,0.95)' },
          }}
        >
          Voir une démo
        </Button>
      )}
    </Box>
  );
}
