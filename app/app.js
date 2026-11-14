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
const skipHint  = document.getElementById('skip-hint');   // optional: the page works without this element
const monologue = document.getElementById('monologue');

let waitingForInput = false;
let onContinue = null;
let skipEnabled = true;    // Esc skips the whole animation, at any point
let skipped = false;       // true once the player has skipped to the slideshow

// After a skip, wait() never finishes, which stops the story where it is
function wait(ms) {
    return new Promise(resolve => setTimeout(() => { if (!skipped) resolve(); }, ms));
}

// Like wait(), but the player can end it early with Space (or a tap).
// Returns true if it was cut short.
let cutWait = null;
function waitOrSkip(ms) {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            cutWait = null;
            if (!skipped) resolve(false);
        }, ms);
        cutWait = () => {
            clearTimeout(timer);
            cutWait = null;
            if (!skipped) resolve(true);
        };
    });
}

function waitForSpace() {
    waitingForInput = true;
    return new Promise(resolve => { onContinue = resolve; });
}

// Space (or a tap): continue from "press space", or skip ahead if the text is still appearing
function advance() {
    if (waitingForInput) {
        waitingForInput = false;
        onContinue();
    } else if (cutWait) {
        cutWait();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();      // stop the page from scrolling
        if (!event.repeat) advance();
    }
    if (event.code === 'Escape') {
        if (roverOpen) goBack();                  // in a section: back to the rover; on a rover: back to the stars
        else if (skipEnabled) skipToSlideshow();  // during the animation: skip to the stars
    }
    if (roverOpen && !currentSection && event.code === 'ArrowLeft')  goToRover(-1);
    if (roverOpen && !currentSection && event.code === 'ArrowRight') goToRover(1);
});

// Touch / click support for phones and tablets: tap anywhere
document.addEventListener('click', advance);

// Tapping the "skip" hint skips the animation too (for phones and tablets)
skipHint?.addEventListener('click', (event) => {
    event.stopPropagation();
    skipToSlideshow();
});

async function playIntro() {
    await waitOrSkip(START_DELAY);

    // Line 1: fades in, holds, fades out on its own
    line1.classList.add('visible');
    await waitOrSkip(FADE_IN_MS + HOLD_MS);
    line1.classList.remove('visible');
    await wait(FADE_OUT_MS + BLACK_MS);

    // Line 2: fades in, then waits for the player
    line2.classList.add('visible');
    const hurried = await waitOrSkip(FADE_IN_MS + PROMPT_DELAY);
    skipEnabled = true;

    if (!hurried) {
        prompt.classList.add('raised');  // the prompt sits above the skip hint
        prompt.classList.add('visible'); // "Press space to continue"
        skipHint?.classList.add('visible');    // "Press esc to skip to slideshow"
        await waitForSpace();

        skipHint?.classList.remove('visible');
        prompt.classList.remove('visible');
        prompt.classList.remove('raised');
    }
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
    if (document.getElementById('slideshow').classList.contains('show')) return;   // already on the stars screen
    skipped = true;
    waitingForInput = false;
    cutWait = null;

    prompt.classList.remove('visible');
    skipHint?.classList.remove('visible');
    narration.classList.remove('visible');
    monologue.querySelectorAll('p').forEach(p => p.classList.remove('visible'));
    hideLabel();
    curtain.classList.add('closed');   // fade to black

    startSlideshow();
}

// The "Discover their story" screen. The title and the stars fade in by themselves (see style.css),
// so this works even after Esc, when the timers above have been stopped.
function startSlideshow() {
    document.getElementById('slideshow').classList.add('show');
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
    const hurried = await waitOrSkip(1500 + text.length * 30);   // time to read; Space skips ahead
    if (!hurried) {
        prompt.classList.add('visible');                         // "Press space to continue"
        await waitForSpace();
        prompt.classList.remove('visible');
    }
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
    showLabel('Perseverance', 'Jezero Crater - Present Day');
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

    // The cinematic part is finished: fade out, play the closing monologue, then the slideshow
    hideLabel();
    curtain.classList.add('closed');
    await wait(1500);

    await playMonologue();
    startSlideshow();
}


/* ================= The closing monologue ================= */

// One beat: its lines appear one after another, with no prompt.
// Space (or a tap) skips ahead to the next line.
async function beat(lines, hold = 2600) {
    monologue.innerHTML = '';
    const paragraphs = lines.map(text => {
        const p = document.createElement('p');
        p.textContent = text;
        monologue.appendChild(p);
        return p;
    });

    for (const p of paragraphs) {
        p.classList.add('visible');
        await waitOrSkip(1400 + p.textContent.length * 32);   // time to read the line
    }
    await waitOrSkip(hold);                                    // a moment with every line on screen

    paragraphs.forEach(p => p.classList.remove('visible'));
    await wait(1400);
}

async function playMonologue() {
    // Beat 1: the possibility
    await beat([
        'Perseverance is still out there, still searching.',
        "In a rock called Cheyava Falls, it found organic molecules, and strange little spots like a leopard's.",
        'On Earth, tiny living things can leave marks like these.',
        "But rocks can make them too. We can't be sure yet."
    ]);

    // Beat 2: the waiting
    await beat([
        'To know for certain, the sample has to reach a laboratory on Earth.',
        'For now, it sits sealed in a tube, still on Mars.',
        'And no mission is ready to bring it home.'
    ]);

    // Beat 3: not alone
    await beat([
        'But Perseverance is not the first explorer we left behind.',
        'Buggies on the Moon. Landers on Mars. Probes still drifting out past the planets.',
        'Some went quiet years ago. Some are still travelling.',
        'Each was built to answer one question.'
    ]);

}

/* ================= Rover screens ================= */

// The facts for each rover, in the same order as the stars
const ROVERS = [
    {
        name: 'Spirit',
        image: 'img/spirit.jpg',
        alt: 'Illustration of a Mars rover like Spirit on the surface of Mars',
        facts: [
            ['Launch', 'June 10, 2003'],
            ['Landing', 'January 4, 2004'],
            ['Landing site', 'Gusev Crater'],
            ['Planned mission', '90 sols'],
            ['Actual mission', 'More than 6 years'],
            ['Distance travelled', 'About 8 km'],
            ['Power source', 'Solar panels'],
            ['Status', 'Silent since 2010'],
            ['Type', 'Rover']
        ]
    },
    {
        name: 'Opportunity',
        image: 'img/opportunity.jpg',
        alt: 'Illustration of the Opportunity rover on the surface of Mars',
        facts: [
            ['Launch', 'July 7, 2003'],
            ['Landing', 'January 25, 2004'],
            ['Landing site', 'Meridiani Planum'],
            ['Planned mission', '90 sols'],
            ['Actual mission', 'Nearly 15 years'],
            ['Distance travelled', 'Over 45 km'],
            ['Power source', 'Solar panels'],
            ['Status', 'Silent since June 2018'],
            ['Type', 'Rover']
        ],

        // What the bottom buttons show. A rover without a section here has that button dimmed.
        // Block types: { h: 'heading' }  { p: 'paragraph' }  { list: ['a', 'b'] }
        //              { photo: {...} }  = a small arrow that reveals a photo
        //              { gallery: [...] } and { parts: [...] }
        // Photos: put the file name in src (for example 'img/opportunity-blueberries.jpg').
        // While src is empty, a "Photo coming soon" frame is shown instead.
        sections: {
            mission: [
                { p: 'At the beginning of the 21st century, scientists suspected that Mars may once have been a very different world. Images from orbit revealed dry river valleys, enormous channels carved into the landscape, and minerals that often form in the presence of water.' },
                { p: 'But orbital images could only suggest a story. Confirming it required evidence from the ground.' },
                { p: 'So NASA built Opportunity, one of two Mars Exploration Rovers, to provide it.' },
                { p: 'The mission’s objective was simple in principle but revolutionary in practice: travel across Mars and search for geological evidence that liquid water once existed there.' },
                { p: 'If water had persisted for long periods, Mars may once have contained environments where microscopic life could survive. Opportunity’s task was to determine whether those environments had ever existed.' }
            ],

            gallery: [
                { gallery: [
                        { src: '', alt: '', caption: '' },
                        { src: '', alt: '', caption: '' },
                        { src: '', alt: '', caption: '' }
                    ] }
            ],

            discoveries: [
                { h: 'The Blueberries' },
                { p: 'Just weeks after landing, Opportunity found thousands of tiny spherical rocks scattered across the ground. Scientists nicknamed them “Martian Blueberries”.' },
                { photo: { src: '', alt: 'The “Martian Blueberries”: tiny round rocks on the surface of Mars', caption: '' } },
                { p: 'These small spheres contained hematite and were strong evidence that water had once interacted with the Martian surface.' },
                { p: 'For scientists, this was a breakthrough.' },
                { p: 'Mars was no longer just a planet that might have had water.' },
                { p: 'There was now physical evidence in front of the rover.' },
                { h: 'Ancient Groundwater' },
                { p: 'Opportunity found rocks that contained chemicals left behind by ancient groundwater.' },
                { p: 'This suggested that water did not simply appear and disappear quickly. Instead, some environments stayed wet for long periods of time.' },
                { h: 'Habitable Environments' },
                { p: 'Opportunity discovered conditions that may once have supported microbial life. It showed that ancient Mars contained places where microorganisms might have survived if they ever existed there.' }
            ],

            journey: [
                { p: 'Opportunity’s story is remarkable not simply because of what it found, but because of how long it survived.' },
                { p: 'The rover landed on the 25th of January, 2004 inside Eagle Crater and immediately found exposed rocks containing clues about Mars’ past. It then traveled across vast regions of the planet, visiting Endurance Crater, Victoria Crater, and eventually the enormous Endeavour Crater.' },
                { p: 'Year after year, Opportunity continued operating.' },
                { p: 'It survived:' },
                { list: ['Dust storms', 'Extreme temperature changes', 'Aging electronics', 'Mechanical wear'] },
                { p: 'The rover eventually traveled more than 45 kilometers across Mars, setting distance records for surface exploration on another world.' },
                { p: 'A mission expected to last three months survived for nearly fifteen years.' },
                { p: 'Its journey ended in 2018 when a planet-wide dust storm blocked sunlight from reaching its solar panels. The rover’s final transmission was received on June 10, 2018.' }
            ],

            parts: [
                { parts: [
                        { name: 'Pancam', text: 'Captured the images that revealed ancient lakebeds, craters, and the geological clues that pointed to a wetter Mars.' },
                        { name: 'Robotic Arm', text: 'Allowed Opportunity to examine rocks up close and investigate signs of ancient water.' },
                        { name: 'Rock Abrasion Tool', text: 'Ground through dusty rock surfaces to expose fresh material hidden beneath millions of years of Martian weathering.' },
                        { name: 'Spectrometers', text: 'Identified minerals such as hematite, helping scientists understand how water shaped Mars long ago.' },
                        { name: 'Solar Panels', text: 'Powered Opportunity for nearly fifteen years before a global dust storm blocked the sunlight it needed to survive.' },
                        { name: 'Wheels', text: 'Carried the rover more than 45 kilometers across Mars, making it one of the longest-traveling explorers on another world.' },
                        { name: 'Antenna', text: 'Sent thousands of images and scientific measurements back to Earth across millions of kilometers of space.' }
                    ] }
            ]
        }
    },
    {
        name: 'InSight',
        image: 'img/insight.jpg',
        alt: 'Illustration of the InSight lander on Mars, with its solar panels open',
        facts: [
            ['Launch', 'May 5, 2018'],
            ['Landing', 'November 26, 2018'],
            ['Landing site', 'Elysium Planitia'],
            ['Planned mission', 'About 2 Earth years'],
            ['Actual mission', 'About 4 Earth years'],
            ['Power source', 'Solar panels'],
            ['Status', 'Silent since December 2022'],
            ['Type', 'Lander']
        ]
    },
    {
        name: 'Sojourner',
        image: 'img/sojourner.jpg',
        alt: 'The Sojourner rover on the surface of Mars, next to the Pathfinder lander',
        facts: [
            ['Launch', 'December 4, 1996'],
            ['Landing', 'July 4, 1997'],
            ['Landing site', 'Ares Vallis'],
            ['Planned mission', '7 sols'],
            ['Actual mission', 'Nearly 3 months'],
            ['Distance travelled', 'About 100 meters'],
            ['Power source', 'Solar panels'],
            ['Status', 'Silent since September 1997'],
            ['Type', 'Rover']
        ]
    }
];

const roverView  = document.getElementById('rover-view');
const roverName  = document.getElementById('rover-name');
const roverPhoto = document.getElementById('rover-photo');
const roverFacts = document.getElementById('rover-facts');
const roverNote  = document.getElementById('rover-note');

let roverOpen = false;
let currentRover = 0;

// Load the photos in the background so they appear instantly
ROVERS.forEach(r => { new Image().src = r.image; });

// Put one rover's name, photo and facts on the screen
function fillRover(i) {
    const rover = ROVERS[i];
    roverName.textContent = rover.name;
    roverPhoto.src = rover.image;
    roverPhoto.alt = rover.alt;

    roverFacts.innerHTML = '';
    for (const [label, value] of rover.facts) {
        const fact = document.createElement('div');
        fact.className = 'fact';
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        fact.append(dt, dd);
        roverFacts.appendChild(fact);
    }

    // "sols" needs a short explanation
    roverNote.hidden = !rover.facts.some(([, value]) => /\bsols?\b/.test(value));

    updateTabs();
}

function openRover(i) {
    currentRover = i;
    fillRover(i);
    roverOpen = true;
    roverView.classList.add('show');
}

function closeRover() {
    roverOpen = false;
    roverView.classList.remove('show');
    resetSection();
}

// step = 1 for the next rover, -1 for the previous one (it loops around)
function goToRover(step) {
    currentRover = (currentRover + step + ROVERS.length) % ROVERS.length;
    roverView.classList.add('swapping');          // fade out
    setTimeout(() => {
        fillRover(currentRover);
        roverView.classList.remove('swapping');   // fade in
    }, 250);
}

document.querySelectorAll('.star').forEach((star, i) => {
    star.addEventListener('click', () => openRover(i));
});
document.getElementById('rover-prev').addEventListener('click', () => goToRover(-1));
document.getElementById('rover-next').addEventListener('click', () => goToRover(1));
document.getElementById('rover-back').addEventListener('click', goBack);


/* ================= Rover sections (Mission, Gallery, Discoveries, Journey, Parts) ================= */

const SECTION_TITLES = {
    mission: 'Mission',
    gallery: 'Gallery',
    discoveries: 'Discoveries',
    journey: 'Journey',
    parts: 'Parts'
};

const roverBack    = document.getElementById('rover-back');
const sectionTitle = document.getElementById('section-title');
const sectionBody  = document.getElementById('section-body');
const tabs         = [...document.querySelectorAll('#rover-tabs button')];

let currentSection = null;   // null = the rover's main screen
let turning = false;         // true for a moment while the screen fades between two views
let photoCount = 0;

// Fade out, change what is on screen, fade back in
function turnTo(change) {
    if (turning) return;
    turning = true;
    roverView.classList.add('turning');
    setTimeout(() => {
        change();
        roverView.classList.remove('turning');
        turning = false;
    }, 250);
}

// An empty frame that waits for a photo
function makeSlot() {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18 L10 13 L14 16 L17 13 L20 16"/></svg><span>Photo coming soon</span>';
    return slot;
}

// A photo with an optional caption. If the file is missing, the empty frame is shown instead.
function makePhoto(spec = {}, extraClass = '') {
    const figure = document.createElement('figure');
    figure.className = ('photo ' + extraClass).trim();

    if (spec.src) {
        const img = document.createElement('img');
        img.src = spec.src;
        img.alt = spec.alt || '';
        img.addEventListener('error', () => img.replaceWith(makeSlot()));
        figure.appendChild(img);
    } else {
        figure.appendChild(makeSlot());
    }

    if (spec.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = spec.caption;
        figure.appendChild(caption);
    }
    return figure;
}

// The small arrow that shows or hides a photo
function makeReveal(spec) {
    const figure = makePhoto(spec, 'wide');
    figure.hidden = true;
    figure.id = 'section-photo-' + (++photoCount);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reveal';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', figure.id);
    button.innerHTML = '<span class="reveal-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 L17 12 L9 20"/></svg></span><span class="reveal-label"></span>';
    const label = button.querySelector('.reveal-label');
    label.textContent = spec.label || 'See the photo';

    button.addEventListener('click', () => {
        const opening = figure.hidden;
        figure.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
        label.textContent = opening ? 'Hide the photo' : (spec.label || 'See the photo');
    });

    return [button, figure];
}

// Build a section from its blocks
function renderSection(blocks) {
    sectionBody.innerHTML = '';
    let wide = false;

    for (const block of blocks) {
        if (block.h) {
            const h = document.createElement('h4');
            h.textContent = block.h;
            sectionBody.appendChild(h);
        } else if (block.p) {
            const p = document.createElement('p');
            p.textContent = block.p;
            sectionBody.appendChild(p);
        } else if (block.list) {
            const ul = document.createElement('ul');
            for (const item of block.list) {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            }
            sectionBody.appendChild(ul);
        } else if (block.photo) {
            sectionBody.append(...makeReveal(block.photo));
        } else if (block.gallery) {
            wide = true;
            const grid = document.createElement('div');
            grid.className = 'gallery';
            for (const spec of block.gallery) grid.appendChild(makePhoto(spec));
            sectionBody.appendChild(grid);
        } else if (block.parts) {
            wide = true;
            const grid = document.createElement('div');
            grid.className = 'parts';
            for (const part of block.parts) {
                const item = document.createElement('div');
                item.className = 'part';
                const name = document.createElement('p');
                name.className = 'part-name';
                name.textContent = part.name;
                const text = document.createElement('p');
                text.className = 'part-text';
                text.textContent = part.text;
                item.append(name, text);
                grid.appendChild(item);
            }
            sectionBody.appendChild(grid);
        }
    }

    sectionBody.classList.toggle('wide', wide);
    sectionBody.scrollTop = 0;
}

// Dim the buttons this rover has no content for; highlight the one that is open
function updateTabs() {
    const sections = ROVERS[currentRover].sections || {};
    for (const tab of tabs) {
        const key = tab.dataset.section;
        tab.setAttribute('aria-disabled', String(!sections[key]));
        if (key === currentSection) tab.setAttribute('aria-current', 'true');
        else tab.removeAttribute('aria-current');
    }
    roverBack.setAttribute('aria-label',
        currentSection ? 'Back to ' + ROVERS[currentRover].name : 'Back to all rovers');
}

function openSection(key) {
    const sections = ROVERS[currentRover].sections;
    if (!sections || !sections[key] || key === currentSection) return;
    turnTo(() => {
        currentSection = key;
        sectionTitle.textContent = SECTION_TITLES[key];
        renderSection(sections[key]);
        roverView.classList.add('in-section');
        updateTabs();
    });
}

function closeSection() {
    if (!currentSection) return;
    turnTo(() => {
        currentSection = null;
        roverView.classList.remove('in-section');
        updateTabs();
    });
}

// Used when the whole rover screen closes
function resetSection() {
    currentSection = null;
    turning = false;
    roverView.classList.remove('in-section', 'turning');
}

// Back button and Esc: one step back (section -> rover -> stars)
function goBack() {
    if (currentSection) closeSection();
    else closeRover();
}

// A button opens its section; pressing the open one again goes back to the rover
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const key = tab.dataset.section;
        if (key === currentSection) closeSection();
        else openSection(key);
    });
});


playIntro();