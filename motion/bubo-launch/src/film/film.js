// The director: one pure function of time that composes every shot onto the master canvas.
import { Paper } from '../lib/paper.js';
import { drawFinale, initFinale } from './finale.js';
import { drawDark, drawHeadline, drawOpening, initOpening } from './opening.js';
import { drawRecall, initRecall } from './recall.js';
import { drawReview, drawReviewOverlay, initReview } from './review.js';
import { DURATION, T } from './timeline.js';

let paper = null;

export function initFilm() {
  paper = new Paper();
  initOpening(paper);
  initRecall(paper);
  initReview(paper);
  initFinale(paper);
}

export function renderFilm(g, t) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.imageSmoothingQuality = 'high';
  // Every frame starts from nothing: no pixel may survive from a previously rendered t.
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.fillStyle = '#F8F5FF';
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  if (t < 1.07) {
    drawOpening(g, t, paper);
    drawHeadline(g, t);
  } else if (t < T.iris[1]) {
    drawDark(g, t);
  } else if (t < T.flipOut[0]) {
    drawRecall(g, t, paper);
  } else if (t < T.flipOut[1]) {
    // The recall screen turns over and reveals the pad of days behind it.
    drawReview(g, t, paper);
    drawRecall(g, t, paper);
    drawReviewOverlay(g, t);
  } else if (t < T.bigJump[0]) {
    drawReview(g, t, paper);
    drawReviewOverlay(g, t);
  } else {
    drawFinale(g, t, paper);
  }
}

/**
 * Shutter (fraction of a frame, 0 = sharp) for temporal motion blur at time t. Only the fast
 * moves get blur, so type and UI stay crisp when they are meant to be read.
 */
export function shutterAt(t) {
  if (t >= 0.97 && t <= 1.06) return { shutter: 0.8, samples: 32 }; // crash into the cover
  if (t >= 0.9 && t <= 1.08) return { shutter: 0.8, samples: 16 }; // the slam
  if (t >= 0.28 && t <= 1.12) return { shutter: 0.7, samples: 8 }; // whip pull-back, the closing
  if (t >= 1.98 && t <= 2.62) return { shutter: 0.5, samples: 6 }; // iris and pull-out
  if (t >= 5.12 && t <= 5.9) return { shutter: 0.6, samples: 8 }; // the screen turns like a page
  if (t >= 7.36 && t <= 9.35) return { shutter: 0.55, samples: 8 }; // fluttering days
  if (t >= 6.7 && t <= 9.98) return { shutter: 0.5, samples: 6 }; // pages of time, the big jump
  if (t >= 11.45 && t <= 12.96) return { shutter: 0.5, samples: 6 }; // cover closes, book flies
  return { shutter: 0, samples: 1 };
}

export { DURATION };
