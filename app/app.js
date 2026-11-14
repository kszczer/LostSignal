// Opening scene timing (milliseconds)
const START_DELAY  = 1500;  // black screen before the first line
const FADE_IN_MS   = 2500;  // keep in sync with --fade-in in style.css
const HOLD_MS      = 2500;  // how long line 1 stays fully visible
const FADE_OUT_MS  = 2000;  // keep in sync with --fade-out in style.css
const BLACK_MS     = 1000;  // pause on pure black between the lines
const PROMPT_DELAY = 1000;  // after line 2 has faded in, wait this long before showing the prompt

const line1  = document.getElementById('line-1');
const line2  = document.getElementById('line-2');
const prompt = document.getElementById('prompt');

const stage     = document.getElementById('stage');
const curtain   = document.getElementById('curtain');
const narration = document.getElementById('narration');
const label     = document.getElementById('label');
const skipHint  = document.getElementById('skip-hint');

let waitingForInput = false;
let onContinue = null;
let skipEnabled = false;   // Esc only works once the "press esc" hint has appeared
let skipped = false;       // true once the player has skipped to the slideshow

// After a skip, wait() never finishes, which stops the story where it is
function wait(ms) {
    return new Promise(resolve => setTimeout(() => { if (!skipped) resolve(); }, ms));
}

function waitForSpace() {
    waitingForInput = true;
    return new Promise(resolve => { onContinue = resolve; });
}

function advance() {
    if (!waitingForInput) return;  // ignore presses while text is fading
    waitingForInput = false;
    onContinue();
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();      // stop the page from scrolling
        if (!event.repeat) advance();
    }
    if (event.code === 'Escape' && skipEnabled) {
        skipToSlideshow();
    }
});

// Touch / click support for phones and tablets
prompt.addEventListener('click', advance);

async function playIntro() {
    await wait(START_DELAY);

    // Line 1: fades in, holds, fades out on its own
    line1.classList.add('visible');
    await wait(FADE_IN_MS + HOLD_MS);
    line1.classList.remove('visible');
    await wait(FADE_OUT_MS + BLACK_MS);

    // Line 2: fades in, then waits for the player
    line2.classList.add('visible');
    await wait(FADE_IN_MS + PROMPT_DELAY);

    prompt.classList.add('visible'); // "Press space to continue"
    skipHint.classList.add('visible');    // "Press esc to skip to slideshow"
    skipEnabled = true;
    await waitForSpace();

    skipHint.classList.remove('visible');
    prompt.classList.remove('visible');
    line2.classList.remove('visible');
    await wait(FADE_OUT_MS + BLACK_MS);

    startNextScene();
}

function startNextScene() {
    playStory();
}

// Esc: stop the story and go to the slideshow
function skipToSlideshow() {
    if (skipped) return;
    skipped = true;
    waitingForInput = false;

    prompt.classList.remove('visible');
    skipHint.classList.remove('visible');
    narration.classList.remove('visible');
    hideLabel();
    curtain.classList.add('closed');   // fade to black

    startSlideshow();
}

function startSlideshow() {
    // The slideshow goes here. For now the screen just fades to black.
}


/* ================= The story ================= */

// Hills: wavy shapes drawn twice as wide as the screen so they can loop smoothly.
// (Whole numbers of waves per 1200 units = no visible seam.)
function ridgePath(base, amp, phase, crater) {
    let d = 'M0,700';
    for (let x = 0; x <= 2400; x += 20) {
        const a = (2 * Math.PI * x) / 1200;
        let y = base + amp * (0.6 * Math.sin(2 * a + phase)
            + 0.3 * Math.sin(5 * a + phase * 1.7)
            + 0.1 * Math.sin(11 * a + phase * 2.3));
        if (crater) {
            const xm = x % 1200;
            y += 38 * Math.exp(-Math.pow((xm - 300) / 80, 2));       // the bowl
            y -= 10 * Math.exp(-Math.pow((Math.abs(xm - 300) - 130) / 14, 2));  // the rim
        }
        d += ' L' + x + ',' + y.toFixed(1);
    }
    return d + ' L2400,700 Z';
}

document.getElementById('ridge-1').setAttribute('d', ridgePath(360, 28, 0.5, false));
document.getElementById('ridge-2').setAttribute('d', ridgePath(430, 34, 2.0, true));
document.getElementById('ridge-3').setAttribute('d', ridgePath(515, 20, 4.0, false));

// Switch which scene is showing: 'mars', 'perseverance', 'flashback' or 'opportunity'
// 'extra' adds more classes, e.g. 'parked scanning'
function setMode(mode, extra = '') {
    const on = stage.classList.contains('on');
    stage.className = [mode, extra, on ? 'on' : ''].filter(Boolean).join(' ');
}

// Fade to black, change scene, fade back in
async function cut(mode) {
    hideLabel();
    curtain.classList.add('closed');
    await wait(1000);
    setMode(mode);
    await wait(400);
    curtain.classList.remove('closed');
    await wait(1200);
}

function showLabel(title, sub) {
    document.getElementById('label-title').textContent = title;
    document.getElementById('label-sub').textContent = sub;
    label.classList.add('show');
}

function hideLabel() {
    label.classList.remove('show');
}

// Show one line of narration, wait for space, fade it out
async function say(text) {
    narration.textContent = text;
    narration.classList.add('visible');
    await wait(1500 + text.length * 30);      // time to read before the prompt appears
    prompt.classList.add('visible');
    await waitForSpace();
    prompt.classList.remove('visible');
    narration.classList.remove('visible');
    await wait(900);
}

async function playStory() {
    // MARS: the camera drifts over valleys and craters
    setMode('mars');
    stage.classList.add('on');
    await wait(4000);

    await say('For millions of years, Mars kept its secrets.');
    await say('Then humans began digging.');

    // Three distant signals
    for (const ping of document.querySelectorAll('.ping')) {
        ping.classList.add('on');
        await wait(2200);
    }
    await wait(1500);

    // PERSEVERANCE
    await cut('perseverance');
    showLabel('Perserverance', 'Jezero Crater - Present Day');
    await wait(8000);                          // the rover drives up to the rock
    stage.classList.add('scanning');
    await wait(3000);
    await say('This rover is searching for clues.');
    await say('Its target: rocks from an ancient lake, and any sign that tiny life once lived there.');
    stage.classList.remove('scanning');        // the scan stops
    await wait(1500);
    hideLabel();
    stage.classList.add('look-up');            // the camera tilts toward the horizon
    await wait(3500);
    await say("But this story didn't begin with Perseverance.");

    // FLASHBACK
    await cut('flashback');
    await wait(3500);
    await say('Long before this rover arrived...');
    await say('others crossed these plains.');
    await wait(3000);

    // OPPORTUNITY
    await cut('opportunity');
    await wait(2500);
    showLabel('Opportunity', 'Last signal received: June 2018');
    await wait(3500);
    await say('It was designed to survive ninety Martian days.');
    await say('It explored Mars for more than fourteen years.');
    await say('It searched for something simple: water.');

    // BLACK SCREEN: narration only
    hideLabel();
    curtain.classList.add('closed');
    await wait(800);                            // keep the black screen short
    await say('What it found changed the direction of every mission that followed...');
    await say('...Because the search did not end there...');
    await say('It evolved.');
    await say('From searching for water...');
    await say('To searching for life.');
    await say('And maybe one day...');

    // PERSEVERANCE again: back at the rock, scanning
    setMode('perseverance', 'parked scanning');
    await wait(600);
    curtain.classList.remove('closed');
    await wait(6500);                           // the rover and the scan stay on screen for a while

    // A microscope-like circle opens over the rock, with blue bacteria jumping around inside
    stage.classList.add('life');
    showLabel('An imagined scene', 'No life has been found on Mars yet');
    await wait(14000);

    // The cinematic part is finished: fade out and hand over to the slideshow
    hideLabel();
    curtain.classList.add('closed');
    await wait(1500);
    startSlideshow();
}

playIntro();