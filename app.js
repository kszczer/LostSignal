// Opening scene timing (milliseconds)
// (Paced a little faster than before; the fade lengths below must stay in sync with style.css)
const START_DELAY  = 1000;  // black screen before the first line
const FADE_IN_MS   = 2500;  // keep in sync with --fade-in in style.css
const HOLD_MS      = 1800;  // how long line 1 stays fully visible
const FADE_OUT_MS  = 2000;  // keep in sync with --fade-out in style.css
const BLACK_MS     = 600;   // pause on pure black between the lines
const PROMPT_DELAY = 700;   // after line 2 has faded in, wait this long before showing the prompt

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
        // keep the prompt in place while it fades out, so it doesn't drop onto the skip hint
        setTimeout(() => prompt.classList.remove('raised'), 1000);
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
    const hurried = await waitOrSkip(1100 + text.length * 24);   // time to read; Space skips ahead
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
    await wait(3000);

    await say('For millions of years, Mars kept its secrets.');
    await say('Then humans got curious.');

    // Three distant signals
    for (const ping of document.querySelectorAll('.ping')) {
        ping.classList.add('on');
        await wait(1700);
    }
    await wait(1000);

    // PERSEVERANCE
    await cut('perseverance');
    showLabel('Perseverance', 'Jezero Crater - Present Day');
    await wait(3200);                          // the rover drives (drive animation is 3.5 s in style.css) up to the rock
    stage.classList.add('scanning');
    await wait(2000);
    await say('This rover is searching for clues.');
    await say('Its target: rocks from an ancient lake, and any sign that tiny life once lived there.');
    stage.classList.remove('scanning');        // the scan stops
    await wait(1000);
    hideLabel();
    stage.classList.add('look-up');            // the camera tilts toward the horizon
    await wait(2500);
    await say("But this story didn't begin with Perseverance.");

    // FLASHBACK
    await cut('flashback');
    await wait(2500);
    await say('Long before this rover arrived...');
    await say('others crossed these plains.');
    await wait(2000);

    // OPPORTUNITY
    await cut('opportunity');
    await wait(1800);
    showLabel('Opportunity', 'Last signal received: June 2018');
    await wait(2500);
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
    await wait(4500);                           // the rover and the scan stay on screen for a while

    // A microscope-like circle opens over the rock, with blue bacteria jumping around inside
    stage.classList.add('life');
    showLabel('An imagined scene', 'No life has been found on Mars yet');
    await wait(10000);

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
async function beat(lines, hold = 1800) {
    monologue.innerHTML = '';
    const paragraphs = lines.map(text => {
        const p = document.createElement('p');
        p.textContent = text;
        monologue.appendChild(p);
        return p;
    });

    for (const p of paragraphs) {
        p.classList.add('visible');
        await waitOrSkip(1000 + p.textContent.length * 26);   // time to read the line
    }
    await waitOrSkip(hold);                                    // a moment with every line on screen

    paragraphs.forEach(p => p.classList.remove('visible'));
    await wait(1100);
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
        'But Opportunity is not the first explorer we left behind.',
        'Buggies on the Moon. Landers on Mars. Probes still drifting out past the planets.',
        'Some went quiet years ago. Some are still travelling.',
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
        ],

        // Same structure as Opportunity's sections: put photo file names in the empty src values.
        sections: {
            mission: [
                { p: 'When Spirit landed on Mars in January 2004, scientists believed they had chosen one of the most promising locations on the planet. From orbit, Gusev Crater appeared to be an ancient lake basin fed by a massive river channel. Billions of years ago, water may have flowed into this crater and remained there for long periods of time.' },
                { p: 'The rover’s mission was to investigate whether this long-lost lake had really existed and whether it had left evidence behind.' },
                { p: 'Spirit was designed to survive for only 90 Martian days, called sols. During that time, it would examine rocks, study the soil, and search for clues about Mars’ watery past. Scientists hoped the rover might reveal whether ancient Mars once contained environments that could support life.' }
            ],

            gallery: [
                { gallery: [
                        { src: 'img/spirit_g/1.png', alt: '', caption: '' },
                        { src: 'img/spirit_g/2.png', alt: '', caption: '' },
                        { src: 'img/spirit_g/3.png', alt: '', caption: '' }
                    ] }
            ],

            discoveries: [
                { p: 'Spirit’s greatest discoveries came after years of exploration.' },
                { p: 'As the rover traveled toward the distant Columbia Hills, it began encountering rocks unlike anything previously studied on Mars. These rocks showed evidence of long-term interaction with water and revealed that some regions of Mars once experienced conditions very different from those seen today.' },
                { p: 'One of Spirit’s most important findings was a large deposit rich in silica. On Earth, similar silica is commonly found around hot springs and hydrothermal systems. These environments are especially interesting because they can provide habitats for microorganisms.' }
            ],

            journey: [
                { p: 'Spirit’s mission became a story of perseverance.' },
                { p: 'After landing safely inside Gusev Crater, the rover spent years traversing rocky plains, climbing hills, and studying the Martian landscape. At first, the mission seemed disappointing. Many of the rocks appeared volcanic and showed little evidence of the ancient lake scientists hoped to find.' },
                { p: 'The answers were not where researchers expected them to be.' },
                { p: 'So Spirit kept driving.' },
                { p: 'The breakthrough came only after Spirit reached the Columbia Hills. The journey there took months, but it proved to be worthwhile - Spirit began finding evidence of a very different Mars. Water-altered rocks, unusual minerals, and signs of ancient environmental changes started appearing everywhere.' },
                { p: 'In 2006, one of Spirit’s wheels stopped working. Initially, this seemed like a major setback. Though, to the scientists’ surprise, the damaged wheel became one of Spirit’s most valuable scientific tools. As it dragged across the surface, it exposed hidden layers of soil that had not been seen for billions of years. Several important discoveries came directly from these accidental trenches.' },
                { p: 'Years later, Spirit became trapped in soft Martian soil. Despite months of rescue attempts by engineers on Earth, the rover could not free itself. Communication was eventually lost in 2010.' },
                { p: 'Today, Spirit remains where it stopped, silently resting on the surface of Mars.' }
            ],

            parts: [
                { parts: [
                        { name: 'Pancam', text: 'Captured panoramic views of Gusev Crater and the Columbia Hills, helping scientists investigate whether the region once contained water.' },
                        { name: 'Robotic Arm', text: 'Enabled Spirit to study Martian rocks and soil up close, revealing evidence that ancient water had altered the landscape.' },
                        { name: 'Rock Abrasion Tool', text: 'Removed weathered rock surfaces, allowing scientists to examine fresh material untouched for billions of years.' },
                        { name: 'Spectrometers', text: 'Identified minerals associated with water activity and helped uncover evidence of ancient hydrothermal environments.' },
                        { name: 'Solar Panels', text: 'Provided power for more than six years of exploration, allowing Spirit to greatly exceed its planned mission lifetime.' },
                        { name: 'Wheels', text: 'Carried Spirit across plains and hills in search of evidence of water. When one wheel failed, it accidentally exposed hidden layers of soil that led to important discoveries.' },
                        { name: 'Antenna', text: 'Sent thousands of images and scientific measurements back to Earth across millions of kilometers of space.' }
                    ] }
            ]
        }
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
                        { src: 'img/opportunity_g/3.png', alt: '', caption: '' },
                        { src: 'img/opportunity_g/4.png', alt: '', caption: '' },
                        { src: 'img/opportunity_g/5.png', alt: '', caption: '' }
                    ] }
            ],

            discoveries: [
                { h: 'The Blueberries' },
                { p: 'Just weeks after landing, Opportunity found thousands of tiny spherical rocks scattered across the ground. Scientists nicknamed them “Martian Blueberries”.' },
                { photo: { src: 'img/opportunity_g/bl.png', alt: 'The “Martian Blueberries”: tiny round rocks on the surface of Mars', caption: '' } },
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
        ],

        // No gallery for InSight: without a "gallery" section its Gallery button stays dimmed.
        sections: {
            mission: [
                { p: 'Most Mars missions are designed to explore the surface.' },
                { p: 'InSight had a different goal.' },
                { p: 'Instead of studying ancient rivers, rocks, and craters, InSight was sent to investigate what lies beneath the surface of Mars. The mission’s name stands for Interior Exploration using Seismic Investigations, Geodesy and Heat Transport.' },
                { p: 'Scientists wanted to answer questions that could not be solved by looking at the landscape alone:' },
                { list: [
                        'How thick is the Martian crust?',
                        'What is hidden beneath the surface?',
                        'Does Mars still experience seismic activity?',
                        'How did Mars form billions of years ago?'
                    ] },
                { p: 'To answer these questions, NASA launched InSight on May 5, 2018. The lander safely touched down in Elysium Planitia on November 26, 2018 and became the first mission dedicated to studying the deep interior of Mars.' }
            ],

            discoveries: [
                { p: 'One of InSight’s most important achievements was detecting hundreds of marsquakes.' },
                { p: 'Just as earthquakes allow scientists to study Earth’s interior, marsquakes allowed researchers to investigate the hidden layers beneath the Martian surface. The vibrations traveled through the planet and revealed information about its structure.' },
                { p: 'InSight also detected seismic signals created when meteorites struck Mars.' },
                { p: 'These impacts helped scientists understand how energy travels through the planet and provided additional clues about its internal structure.' },
                { p: 'InSight continuously measured the planet’s wind, temperature and air pressure.' }
            ],

            journey: [
                { p: 'Unlike Spirit, Opportunity, Curiosity, and Perseverance, InSight never traveled across Mars.' },
                { p: 'The moment it touched the surface, it had arrived at its destination. For four years, InSight sat alone on a flat Martian plain.' },
                { p: 'InSight relied on solar panels for power. Over time, wind carried dust onto the panels, reducing the amount of sunlight they could capture. As power levels declined, the spacecraft gradually shut down systems to conserve energy.' },
                { p: 'In December 2022, communication with InSight ended. The mission had successfully completed its scientific objectives and far exceeded its planned primary mission.' },
                { p: 'Today, the lander remains exactly where it worked, resting quietly on the plains of Mars.' }
            ],

            parts: [
                { parts: [
                        { name: 'Instrument Deployment Camera', text: 'Captured images of the landing site and helped engineers monitor instrument placement.' },
                        { name: 'Robotic Arm', text: 'Used to place scientific instruments directly onto the Martian surface.' },
                        { name: 'SEIS Seismometer', text: 'The mission’s most important instrument. It detected marsquakes and allowed scientists to study the interior of Mars.' },
                        { name: 'Heat Flow Probe', text: 'Designed to investigate heat escaping from the interior of the planet and study subsurface conditions.' },
                        { name: 'Weather Sensors', text: 'Measured wind, pressure, and temperature throughout the mission.' },
                        { name: 'Solar Panels', text: 'Provided electrical power for more than four years of scientific operations.' },
                        { name: 'Antenna', text: 'Transmitted scientific measurements and discoveries back to Earth.' }
                    ] }
            ]
        }
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
        ],

        // No gallery for Sojourner: without a "gallery" section its Gallery button stays dimmed.
        sections: {
            mission: [
                { p: 'Sojourner arrived on Mars on July 4, 1997 as part of NASA’s Mars Pathfinder mission. It became the first rover to successfully drive on another planet and marked the beginning of a new era of robotic exploration.' },
                { p: 'At the time, NASA was not trying to answer whether life existed on Mars.' },
                { p: 'First we had to find out if our technology could even survive on a different planet.' },
                { p: 'The mission was designed as both a scientific investigation and a technology demonstration. If successful, it would prove that future generations of rovers could venture farther and explore more of Mars.' }
            ],

            discoveries: [
                { p: 'Sojourner landed in a region called Ares Vallis, a vast plain believed to have been shaped by catastrophic floods billions of years ago.' },
                { p: 'By studying rocks and soil around its landing site, the rover helped scientists better understand how water may have shaped the Martian surface in the distant past.' },
                { p: 'But perhaps Sojourner’s most important discovery was not scientific at all.' },
                { p: 'It demonstrated that a small robotic explorer could:' },
                { list: [
                        'navigate Martian terrain,',
                        'avoid obstacles,',
                        'perform scientific investigations,',
                        'and most importantly, survive on another planet.'
                    ] },
                { p: 'Without that success, later rover missions might never have happened.' }
            ],

            journey: [
                { p: 'Shortly after landing, Sojourner rolled down a ramp and became the first rover to drive across the surface of Mars.' },
                { p: 'Its tracks marked the beginning of mobile robotic exploration beyond Earth.' },
                { p: 'The rover spent its days carefully driving between rocks, analyzing their composition, and photographing the surrounding terrain.' },
                { p: 'Unlike modern rovers that travel many kilometers, Sojourner stayed relatively close to its lander. Still, every meter felt like a mile.' },
                { p: 'The rover was originally expected to operate for only a short period, but it continued functioning well beyond its planned mission.' },
                { p: 'Communication was eventually lost later in 1997.' },
                { p: 'Even though the mission was brief compared to later rovers, its impact would be felt for decades.' }
            ],

            parts: [
                { parts: [
                        { name: 'Cameras', text: 'Captured images of the Martian surface and helped engineers navigate the rover.' },
                        { name: 'Mobility System', text: 'Allowed Sojourner to drive over rocks and uneven terrain, demonstrating that planetary rovers could operate successfully on Mars.' },
                        { name: 'Alpha Proton X-Ray Spectrometer', text: 'Measured the chemical composition of rocks and soil.' },
                        { name: 'Solar Panels', text: 'Converted sunlight into electricity to power the rover.' },
                        { name: 'Wheels', text: 'Enabled the first successful surface exploration by a rover on another planet.' },
                        { name: 'Communication System', text: 'Sent images and scientific data to the Pathfinder lander, which relayed the information back to Earth.' }
                    ] }
            ]
        }
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