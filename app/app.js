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

let waitingForInput = false;
let onContinue = null;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    prompt.classList.add('visible');   // "Press space to continue"
    await waitForSpace();

    prompt.classList.remove('visible');
    line2.classList.remove('visible');
    await wait(FADE_OUT_MS + BLACK_MS);

    startNextScene();
}

function startNextScene() {
    // The intro is over. The next scene (animation, map, etc.) will start here.
}

//animation, slideshow + further narration about perseverance and how important it could be for discovering potential life
/*CUT TO MARS
The camera slowly moves over valleys, craters, and dried riverbeds. // jezeli sie nie da, to animacja jak perseverence leci na marsa
NARRATOR
For millions of years, Mars kept its secrets.
Then humans began digging.
A distant signal appears.
Then another.
Then another.
CUT TO PERSEVERANCE
Its wheels leave tracks in the dust.
A label appears:
Jezero Crater
Present Day
The rover approaches a rock outcrop.
Instruments scan.
Data streams across the screen.
NARRATOR
This rover is searching for clues.
A pause.
The scan stops.
The camera tilts toward the horizon.
NARRATOR
But this story didn't begin with Perseverance.
Screen fades to black
FLASHBACK
Old wheel tracks.
Half-covered by dust.
NARRATOR
Long before this rover arrived...
others crossed these plains.
The tracks disappear into the distance.
CUT TO A SILENT ROVER COVERED IN MARTIAN DUST
No movement. No signals.
Text fades in:
Opportunity
Last Signal Received: June 2018
NARRATOR
It was designed to survive ninety days.
It explored Mars for nearly fifteen years.*/
//an interactive slideshow

playIntro();