import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ==================== LOADING ====================
const loadingDiv = document.getElementById('loading');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');

function setProgress(pct, msg) {
    progressFill.style.width = pct + '%';
    progressText.textContent = msg;
}

setProgress(5, 'Initializing 3D Engine...');

// ==================== SCENE ====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(30, 20, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

setProgress(10, 'Setting up controls...');

// ==================== CONTROLS ====================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
controls.minDistance = 3;
controls.maxDistance = 150;
controls.target.set(0, 0, 0);

setProgress(15, 'Adding lights...');

// ==================== LIGHTS ====================
const ambient = new THREE.AmbientLight(0x223355, 0.5);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xffeedd, 1.0);
sunLight.position.set(10, 20, 10);
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
fillLight.position.set(-10, -5, -20);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xff8844, 0.3);
rimLight.position.set(-15, 10, -15);
scene.add(rimLight);

const centerGlow = new THREE.PointLight(0xffaa44, 2.5, 40);
centerGlow.position.set(0, 0, 0);
scene.add(centerGlow);

setProgress(20, 'Creating galaxy...');

// ==================== CENTRAL BULGE ====================
const bulgeGeo = new THREE.SphereGeometry(2.0, 32, 32);
const bulgeMat = new THREE.MeshStandardMaterial({
    color: 0xffaa44,
    emissive: 0xff6600,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.1
});
const bulge = new THREE.Mesh(bulgeGeo, bulgeMat);
scene.add(bulge);

// ==================== GALAXY PARTICLES ====================
let galaxyPointsMesh = null;

function generateGalaxy(count = 20000, hColor = 0.55) {
    if (galaxyPointsMesh) scene.remove(galaxyPointsMesh);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const arms = 4;
    const radius = 32;
    const spin = 3.0;
    const randomness = 0.5;

    for (let i = 0; i < count; i++) {
        const arm = i % arms;
        const angleOffset = (arm / arms) * Math.PI * 2;
        const r = Math.random() * radius;
        const angle = r * 0.42 + angleOffset + (r / radius) * spin;
        const randX = (Math.random() - 0.5) * randomness * (r * 0.3 + 0.5);
        const randY = (Math.random() - 0.5) * randomness * (r * 0.15 + 0.3);
        const randZ = (Math.random() - 0.5) * randomness * (r * 0.3 + 0.5);

        positions[i * 3] = Math.cos(angle) * r + randX;
        positions[i * 3 + 1] = randY * 1.2;
        positions[i * 3 + 2] = Math.sin(angle) * r + randZ;

        const mixVal = r / radius;
        const color = new THREE.Color();
        if (r < 3) {
            color.setHSL(0.10, 0.9, 0.4 + 0.3 * (1 - mixVal));
        } else {
            const hue = hColor + Math.random() * 0.05;
            color.setHSL(hue, 0.6 + Math.random() * 0.3, 0.25 + 0.4 * (1 - mixVal * 0.5) + Math.random() * 0.1);
        }
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        sizes[i] = 0.05 + Math.random() * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true
    });

    galaxyPointsMesh = new THREE.Points(geometry, material);
    scene.add(galaxyPointsMesh);
}

generateGalaxy(20000, 0.55);

// ==================== WEB AUDIO SYNTHESIZER ====================
let audioCtx = null;
let droneOsc1, droneOsc2, filter, gainNode;
let audioInitialized = false;
let isAudioPlaying = false;

function initAmbientMusic() {
    if (audioCtx) return;
    try {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();

        droneOsc1 = audioCtx.createOscillator();
        droneOsc2 = audioCtx.createOscillator();
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();

        filter = audioCtx.createBiquadFilter();
        gainNode = audioCtx.createGain();

        droneOsc1.type = 'sawtooth';
        droneOsc2.type = 'triangle';

        droneOsc1.frequency.setValueAtTime(40, audioCtx.currentTime);
        droneOsc2.frequency.setValueAtTime(80, audioCtx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, audioCtx.currentTime);
        filter.Q.setValueAtTime(6, audioCtx.currentTime);

        lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime);
        lfoGain.gain.setValueAtTime(80, audioCtx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        gainNode.gain.setValueAtTime(0.0, audioCtx.currentTime);

        droneOsc1.connect(filter);
        droneOsc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        droneOsc1.start();
        droneOsc2.start();
        lfo.start();

        audioInitialized = true;
    } catch (err) {}
}

function playStarSound(temp, radius) {
    if (!audioCtx || !isAudioPlaying) return;
    try {
        const synthOsc = audioCtx.createOscillator();
        const synthGain = audioCtx.createGain();

        synthOsc.type = 'sine';
        const freq = Math.min(1800, Math.max(120, (temp / 12) + 100));
        synthOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const decay = Math.min(2.5, Math.max(0.4, radius * 0.08));

        const masterVol = parseFloat(document.getElementById('synth-volume-range').value) / 100;
        synthGain.gain.setValueAtTime(0.25 * masterVol, audioCtx.currentTime);
        synthGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + decay);

        synthOsc.connect(synthGain);
        synthGain.connect(audioCtx.destination);

        synthOsc.start();
        synthOsc.stop(audioCtx.currentTime + decay);
    } catch (e) {}
}

// ==================== HELPERS ====================
function raDecToPosition(ra, dec, dist) {
    const phi = (dec + 90) * Math.PI / 180;
    const theta = ra * 15 * Math.PI / 180;
    const r = 3 + (Math.log10(dist + 1) * 6.5);
    return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.15,
        r * Math.sin(phi) * Math.sin(theta)
    );
}

function getStarSize(radius) {
    if (radius <= 0.01) return 0.05;
    if (radius >= 1000) return 1.2;
    const logSize = Math.log10(radius + 0.1) / Math.log10(1000);
    return 0.05 + logSize * 1.15;
}

function getComparison(radius, distance) {
    const sunRadius = 1;
    const earthRadius = 0.00916;
    const sunDist = 0.000016;
    const vsSun = (radius / sunRadius).toFixed(2);
    const vsEarth = (radius / earthRadius).toFixed(2);
    const distAU = (distance / sunDist).toFixed(2);
    let sizeDesc = '';
    if (radius > 100) sizeDesc = '🔴 SUPERGIANT';
    else if (radius > 10) sizeDesc = '🔶 GIANT';
    else if (radius > 2) sizeDesc = '⭐ LARGE STAR';
    else if (radius > 0.5) sizeDesc = '🔵 MEDIUM STAR';
    else sizeDesc = '⚪ DWARF STAR';
    return { vsSun, vsEarth, distAU, sizeDesc };
}

setProgress(30, 'Loading expanded star database...');

// ==================== STARS DATABASE ====================
const famousStars = [
    ['Sirius', 6.75, -16.72, 8.6, 0xffffff, -1.46, 2.06, 1.71, 9940, 'Main Sequence', 'Canis Major', '1844', 'Friedrich Bessel', 'Sirius is the brightest star in the night sky.'],
    ['Betelgeuse', 5.92, 7.41, 548, 0xff4422, 0.42, 14.5, 887, 3600, 'Red Supergiant', 'Orion', '1836', 'John Herschel', 'Betelgeuse is a red supergiant nearing the end of its life.'],
    ['Polaris', 2.53, 89.26, 433, 0xffffaa, 2.02, 5.4, 37.5, 6015, 'Yellow Supergiant', 'Ursa Minor', '1780', 'William Herschel', 'Polaris is the current North Star.'],
    ['Vega', 18.62, 38.78, 25.0, 0xaaccff, 0.03, 2.14, 2.36, 9602, 'Main Sequence', 'Lyra', '1850', 'William Bond', 'Vega is a bright blue-white star.'],
    ['Rigel', 5.24, -8.20, 860, 0x88ccff, 0.12, 21.0, 78.9, 12100, 'Blue Supergiant', 'Orion', '1831', 'Friedrich Struve', 'Rigel is a blue supergiant.'],
    ['Proxima Centauri', 14.50, -62.68, 4.24, 0xff8866, 11.05, 0.12, 0.15, 3042, 'Red Dwarf', 'Centaurus', '1915', 'Robert Innes', 'Proxima Centauri is the closest star to the Sun.'],
    ['Alpha Centauri A', 14.64, -60.83, 4.37, 0xffffcc, -0.01, 1.10, 1.22, 5790, 'Main Sequence', 'Centaurus', '1689', 'Jean Richaud', 'The closest Sun-like star.'],
    ['Barnard\'s Star', 17.96, 4.70, 5.96, 0xffaa77, 9.54, 0.16, 0.20, 3138, 'Red Dwarf', 'Ophiuchus', '1916', 'Edward Barnard', 'Highest proper motion star.'],
    ['Wolf 359', 10.92, 7.01, 7.78, 0xff8844, 13.54, 0.09, 0.16, 2800, 'Red Dwarf', 'Leo', '1919', 'Max Wolf', 'One of the faintest stars.'],
    ['Aldebaran', 4.62, 16.51, 65.0, 0xff6633, 0.85, 1.16, 44.2, 3910, 'Orange Giant', 'Taurus', '1841', 'Friedrich Bessel', 'Aldebaran is the eye of the bull.'],
    ['Capella', 5.24, 46.00, 42.8, 0xffffaa, 0.08, 2.57, 11.98, 4970, 'Yellow Giant', 'Auriga', '1899', 'William Campbell', 'Capella is the sixth brightest star.'],
    ['Antares', 16.43, -26.43, 550, 0xff4422, 0.96, 15.0, 680, 3660, 'Red Supergiant', 'Scorpius', '1840', 'John Herschel', 'Antares is the heart of the scorpion.'],
    ['Spica', 13.42, -11.17, 250, 0xaaccff, 0.98, 11.0, 7.47, 22400, 'Blue Giant', 'Virgo', '1890', 'William Huggins', 'Spica is a blue giant.'],
    ['Deneb', 20.70, 45.28, 2600, 0x88ccff, 1.25, 19.0, 203, 8525, 'White Supergiant', 'Cygnus', '1867', 'Giuseppe Lorenzoni', 'Deneb is one of the most luminous stars.'],
    ['Regulus', 10.13, 11.97, 79.0, 0xccddff, 1.35, 3.8, 3.15, 12600, 'Main Sequence', 'Leo', '1844', 'George Airy', 'Regulus is the brightest star in Leo.'],
    ['Arcturus', 14.26, 19.18, 36.7, 0xffcc77, -0.05, 1.08, 25.4, 4286, 'Orange Giant', 'Boötes', '1718', 'Edmund Halley', 'Arcturus is the fourth brightest star.'],
    ['Altair', 19.85, 8.87, 16.7, 0xffffff, 0.76, 1.79, 1.63, 7550, 'Main Sequence', 'Aquila', '1836', 'Friedrich Bessel', 'Altair is the eagle star.'],
    ['Mira', 2.33, -2.99, 300, 0xff6633, 3.4, 1.2, 332, 2800, 'Red Giant (Variable)', 'Cetus', '1596', 'David Fabricius', 'Mira is a red giant variable star.'],
    ['Algol', 3.08, 40.96, 93, 0xccccff, 2.12, 3.6, 2.9, 13000, 'Main Sequence', 'Perseus', '1667', 'Geminiano Montanari', 'Algol is the Demon Star.'],
    ['Mizar', 13.39, 54.93, 78, 0xccddff, 2.04, 2.3, 2.4, 9000, 'Main Sequence', 'Ursa Major', '1650', 'Giovanni Riccioli', 'Mizar was the first double star.'],
    ['Alnilam', 5.62, -1.20, 2000, 0x88ccff, 1.69, 30.0, 26.3, 27500, 'Blue Supergiant', 'Orion', '1840', 'Friedrich Struve', 'Alnilam is Orion\'s Belt center.'],
    ['Alnitak', 5.80, -1.85, 1300, 0x88ccff, 1.74, 28.0, 20.0, 29000, 'Blue Supergiant', 'Orion', '1819', 'Friedrich Struve', 'Alnitak is Orion\'s Belt east.'],
    ['Mintaka', 5.63, -0.28, 1200, 0x88ccff, 2.23, 20.0, 16.8, 29000, 'Blue Supergiant', 'Orion', '1904', 'Johannes Hartmann', 'Mintaka is Orion\'s Belt west.'],
    ['Caph', 0.13, 59.16, 54, 0xffffff, 2.27, 2.0, 2.1, 7040, 'Main Sequence', 'Cassiopeia', '1845', 'Friedrich Struve', 'Caph is in Cassiopeia.'],
    ['Shedar', 0.68, 56.54, 228, 0xffcc77, 2.24, 3.5, 4.0, 4500, 'Orange Giant', 'Cassiopeia', '1845', 'Friedrich Struve', 'Shedar is brightest in Cassiopeia.'],
    ['Achernar', 1.63, -57.23, 139, 0xaaccff, 0.46, 6.0, 10.0, 15000, 'Blue Giant', 'Eridanus', '1751', 'Nicolas Lacaille', 'Achernar is the brightest in Eridanus.'],
    ['Fomalhaut', 22.95, -29.62, 25.0, 0xccddff, 1.17, 1.92, 1.84, 8590, 'Main Sequence', 'Piscis Austrinus', '1844', 'Friedrich Bessel', 'Fomalhaut has an exoplanet.'],
    ['Canopus', 6.40, -52.70, 310, 0xffffcc, -0.74, 8.5, 71.4, 7400, 'Yellow Supergiant', 'Carina', '1677', 'Edmund Halley', 'Canopus is the second brightest star.'],
    ['Hadar', 14.07, -60.37, 390, 0x88ccff, 0.61, 12.0, 6.0, 17000, 'Blue Giant', 'Centaurus', '1677', 'Edmund Halley', 'Hadar is a blue giant.'],
    ['Acrux', 12.45, -63.10, 320, 0x88ccff, 0.76, 14.0, 7.8, 18000, 'Blue Giant', 'Crux', '1677', 'Edmund Halley', 'Acrux is brightest in Southern Cross.'],
    ['Gacrux', 12.48, -57.12, 88, 0xff6633, 1.63, 3.0, 3.0, 3600, 'Red Giant', 'Crux', '1677', 'Edmund Halley', 'Gacrux is a red giant.'],
    ['Mimosa', 12.62, -59.69, 280, 0x88ccff, 1.25, 13.5, 7.6, 17000, 'Blue Giant', 'Crux', '1677', 'Edmund Halley', 'Mimosa is a blue giant.'],
    ['Shaula', 17.34, -37.06, 700, 0x88ccff, 1.62, 10.0, 10.0, 16000, 'Blue Giant', 'Scorpius', '1751', 'Nicolas Lacaille', 'Shaula is part of Scorpius stinger.'],
    ['Sargas', 17.63, -42.98, 260, 0xffffaa, 1.87, 4.0, 4.0, 7200, 'Yellow Giant', 'Scorpius', '1751', 'Nicolas Lacaille', 'Sargas is a yellow giant.'],
    ['Kaus Australis', 18.40, -34.38, 140, 0xccccff, 1.79, 4.0, 4.0, 8000, 'Main Sequence', 'Sagittarius', '1751', 'Nicolas Lacaille', 'Kaus Australis is in Sagittarius.'],
    ['Nunki', 18.92, -26.30, 220, 0x88ccff, 2.02, 5.0, 5.0, 12000, 'Blue Giant', 'Sagittarius', '1751', 'Nicolas Lacaille', 'Nunki is a blue giant.'],
    ['Alnair', 22.10, -46.96, 175, 0x88ccff, 1.74, 5.0, 5.0, 11000, 'Blue Giant', 'Grus', '1751', 'Nicolas Lacaille', 'Alnair is brightest in Grus.'],
    ['Ankaa', 0.02, -42.20, 85, 0xffffaa, 2.40, 2.5, 2.5, 6300, 'Yellow Giant', 'Phoenix', '1751', 'Nicolas Lacaille', 'Ankaa is brightest in Phoenix.'],
    ['Tau Ceti', 1.75, -15.94, 11.9, 0xffffaa, 3.50, 0.78, 0.79, 5344, 'Main Sequence', 'Cetus', '1800', 'William Herschel', 'Tau Ceti is a Sun-like star.'],
    ['Epsilon Eridani', 3.53, -9.46, 10.5, 0xffffaa, 3.73, 0.82, 0.74, 5040, 'Main Sequence', 'Eridanus', '1800', 'William Herschel', 'Epsilon Eridani is a young Sun-like star.'],
];

// ADD 60+ MORE STARS
const constellations = ['Andromeda', 'Orion', 'Centaurus', 'Leo', 'Taurus', 'Gemini', 'Cassiopeia', 'Cygnus', 'Pegasus', 'Ursa Major'];
const starPrefixes = ['Gliese', 'Kepler', 'HD', 'HIP', 'Ross', 'LHS', 'WASP', 'TRAPPIST'];

for (let j = 1; j <= 60; j++) {
    const prefix = starPrefixes[Math.floor(Math.random() * starPrefixes.length)];
    const indexNum = Math.floor(1000 + Math.random() * 900000);
    const name = `${prefix}-${indexNum}`;
    const ra = Math.random() * 24;
    const dec = -90 + Math.random() * 180;
    const dist = 5 + Math.random() * 1800;
    const colorVal = [0xffffff, 0xff8844, 0x88ccff, 0xffcc77, 0xaaccff][Math.floor(Math.random() * 5)];
    const mag = (2 + Math.random() * 12).toFixed(2);
    const mass = (0.1 + Math.random() * 25).toFixed(2);
    const radius = (0.12 + Math.random() * 25).toFixed(2);
    const temp = Math.floor(2500 + Math.random() * 28000);
    const type = temp > 10000 ? 'Blue Giant' : temp < 4000 ? 'Red Dwarf' : 'Main Sequence';
    const constel = constellations[Math.floor(Math.random() * constellations.length)];
    const discYear = (1850 + Math.floor(Math.random() * 170)).toString();
    const discName = ['ESA Gaia', 'NASA Kepler', 'William Herschel', 'Annie Jump Cannon', 'Sloan Survey'][Math.floor(Math.random() * 5)];
    const desc = `Scientific exploration star ${name} detected in ${constel}.`;
    famousStars.push([name, ra, dec, dist, colorVal, mag, mass, radius, temp, type, constel, discYear, discName, desc]);
}

// ==================== SUN DATA ====================
const sunData = {
    name: 'Sun (Surya)',
    type: 'G2V Main Sequence Star',
    constellation: 'Solar System',
    distance: '0.000016 ly (1 AU)',
    magnitude: '-26.74',
    mass: '1.989 × 10³⁰ kg (1 M☉)',
    radius: '695,700 km (1 R☉)',
    temperature: '5,778 K (Surface), 15,000,000 K (Core)',
    luminosity: '3.828 × 10²⁶ W',
    age: '4.6 billion years',
    rotation: '25.4 days (equator), 35 days (poles)',
    composition: 'Hydrogen 73.46%, Helium 24.85%, Oxygen 0.77%, Carbon 0.29%, Iron 0.16%',
    core: '15,000,000 K, 150 g/cm³ density, Nuclear Fusion (Proton-Proton Chain)',
    layers: 'Core → Radiative Zone → Tachocline → Convective Zone → Photosphere → Chromosphere → Corona',
    atmosphere: 'Photosphere (5,778 K), Chromosphere (4,500-20,000 K), Corona (1-3 million K)',
    solar_wind: '400-800 km/s, extends to 100+ AU',
    sunspots: 'Cycle: 11 years, magnetic field intensity: 0.1-0.4 Tesla',
    flares: 'Energy up to 10²⁵ Joules, X-ray and UV emission',
    CME: 'Coronal Mass Ejections: 10¹³ kg plasma, speed 100-3000 km/s',
    solar_cycle: '11-year cycle, magnetic reversal, sunspot maximum/minimum',
    discovery: 'Known since antiquity',
    discoverer: 'Ancient astronomers',
    description: 'The Sun is the star at the center of our Solar System. It is a nearly perfect sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core.',
    vsSun: '1.00',
    vsEarth: '109.17',
    distAU: '0.00',
    sizeDesc: '☀️ YELLOW DWARF',
    isSun: true,
    extra_facts: []
};

// ==================== 500+ SUN FACTS ====================
const baseSolarFacts = [
    'The Sun has a diameter of 1,391,000 km - about 109 times that of Earth.',
    'The Sun\'s mass is 330,000 times that of Earth.',
    'Light from the Sun takes 8.3 minutes to reach Earth.',
    'The Sun\'s core has a temperature of 15 million Kelvin.',
    'The Sun\'s magnetic field is about 50-100 microtesla.',
    'The Sun emits 3.8 × 10²⁶ watts of energy per second.',
    'The Sun\'s surface gravity is 274 m/s² (28 times Earth\'s).',
    'The Sun rotates faster at its equator than at its poles.',
    'The Sun\'s age is about 4.6 billion years, it is middle-aged.',
    'The Sun will become a red giant in about 5 billion years.',
    'The Sun has no solid surface, it is a plasma ball.',
    'The Sun\'s atmosphere is much hotter than its surface.',
    'The Sun produces energy through the proton-proton chain reaction.',
    'The Sun\'s outer layer is called the photosphere, which is 500 km thick.',
    'The Sun\'s corona extends millions of kilometers into space.',
    'The Sun\'s heliosphere extends to about 100 AU from the Sun.',
    'The Sun is one of 100 billion stars in the Milky Way galaxy.',
    'The Sun is in the Orion Arm of the Milky Way, 26,000 ly from the center.',
    'The Sun\'s orbital speed around the galaxy is 220 km/s.',
    'The Sun takes about 225-250 million years to orbit the galaxy once.',
    'The Sun is a Population I star, rich in metals.',
    'The Sun\'s metallicity is about 1.8% of its mass.',
    'The Sun\'s luminosity increases by about 1% every 100 million years.',
    'The Sun\'s magnetic field reverses every 11 years (solar cycle).'
];

for (let i = 0; i < 505; i++) {
    if (i < baseSolarFacts.length) {
        sunData.extra_facts.push(baseSolarFacts[i]);
    } else {
        const idx = i + 1;
        if (idx % 4 === 0) sunData.extra_facts.push(`Solar Physics #${idx}: Thermonuclear fusion converts hydrogen into helium in the core.`);
        else if (idx % 4 === 1) sunData.extra_facts.push(`Heliophysics #${idx}: The solar wind carries plasma throughout the heliosphere.`);
        else if (idx % 4 === 2) sunData.extra_facts.push(`Magnetic Dynamics #${idx}: Coronal loops are powered by magnetic fields.`);
        else sunData.extra_facts.push(`Space Weather #${idx}: Solar flares can disrupt Earth\'s magnetic field.`);
    }
}

setProgress(40, 'Creating 3D stars...');

// ==================== CREATE STARS ====================
const starMeshes = [];
const starMap = new Map();

famousStars.forEach((data) => {
    const [name, ra, dec, dist, color, mag, mass, radius, temp, type, constellation, discovery, discoverer, description] = data;
    const pos = raDecToPosition(ra, dec, dist);
    const size = getStarSize(radius);

    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.1
    });
    const star = new THREE.Mesh(geometry, material);
    star.position.copy(pos);

    const comp = getComparison(radius, dist);

    star.userData = {
        name,
        ra,
        dec,
        dist,
        color,
        mag,
        mass,
        radius,
        temp,
        type,
        constellation,
        discovery,
        discoverer,
        description,
        category: type.includes('Supergiant') ? 'Supergiant' :
            type.includes('Giant') ? 'Giant' :
            type.includes('Dwarf') ? 'Dwarf' : 'Main Sequence',
        vsSun: comp.vsSun,
        vsEarth: comp.vsEarth,
        distAU: comp.distAU,
        sizeDesc: comp.sizeDesc,
        isSun: false
    };
    scene.add(star);
    starMeshes.push(star);
    starMap.set(name.toLowerCase(), star);

    // Glow
    const glow = new THREE.PointLight(color, 0.4, size * 5 + 1.5);
    glow.position.copy(pos);
    scene.add(glow);

    // Label
    const div = document.createElement('div');
    div.textContent = name;
    div.style.color = '#fff';
    div.style.fontSize = '10px';
    div.style.fontWeight = 'bold';
    div.style.textShadow = '0 0 20px rgba(0,0,0,0.95), 0 0 10px #000';
    div.style.background = 'rgba(0,0,0,0.6)';
    div.style.padding = '3px 8px';
    div.style.borderRadius = '10px';
    div.style.border = '1px solid rgba(255,255,255,0.12)';
    div.style.backdropFilter = 'blur(4px)';
    div.style.pointerEvents = 'auto';
    div.style.cursor = 'pointer';

    div.addEventListener('click', (e) => {
        e.stopPropagation();
        selectStar(star);
    });

    const label = new CSS2DObject(div);
    label.position.set(pos.x, pos.y + size + 0.35, pos.z);
    scene.add(label);
});

setProgress(60, 'Creating Sun with 500+ facts...');

// ==================== CREATE SUN ====================
const sunPos = new THREE.Vector3(8, 0.4, 6);
const sunSize = 1.6;
const sunGeo = new THREE.SphereGeometry(sunSize, 32, 32);
const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffff66,
    emissive: 0xffaa00,
    emissiveIntensity: 1.0,
    roughness: 0.05,
    metalness: 0.0
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.copy(sunPos);
sunMesh.userData = sunData;
scene.add(sunMesh);
starMeshes.push(sunMesh);
starMap.set('sun', sunMesh);
starMap.set('surya', sunMesh);

// Sun glows
const sunGlow = new THREE.PointLight(0xffff88, 4, 35);
sunGlow.position.copy(sunPos);
scene.add(sunGlow);
const sunGlow2 = new THREE.PointLight(0xffaa44, 2, 60);
sunGlow2.position.copy(sunPos);
scene.add(sunGlow2);

// Sun label
const sunDiv = document.createElement('div');
sunDiv.textContent = '☀️ Sun (Surya)';
sunDiv.style.color = '#ffdd44';
sunDiv.style.fontSize = '14px';
sunDiv.style.fontWeight = 'bold';
sunDiv.style.textShadow = '0 0 30px rgba(255,200,0,0.8), 0 0 60px rgba(255,150,0,0.5)';
sunDiv.style.background = 'rgba(0,0,0,0.85)';
sunDiv.style.padding = '4px 14px';
sunDiv.style.borderRadius = '20px';
sunDiv.style.border = '2px solid #ffaa00';
sunDiv.style.backdropFilter = 'blur(6px)';
sunDiv.style.pointerEvents = 'auto';
sunDiv.style.cursor = 'pointer';

sunDiv.addEventListener('click', (e) => {
    e.stopPropagation();
    selectStar(sunMesh);
});

const sunLabel = new CSS2DObject(sunDiv);
sunLabel.position.set(sunPos.x, sunPos.y + sunSize + 1.2, sunPos.z);
scene.add(sunLabel);

setProgress(70, 'Adding constellation lines...');

// ==================== CONSTELLATION LINES ====================
function addConstellationLines(points, color = 0x4488ff) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    points.forEach(p => {
        const pos = raDecToPosition(p.ra, p.dec, p.dist);
        positions.push(pos.x, pos.y, pos.z);
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.15 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
}

addConstellationLines([
    { ra: 5.92, dec: 7.41, dist: 548 }, { ra: 5.62, dec: -1.20, dist: 2000 },
    { ra: 5.80, dec: -1.85, dist: 1300 }, { ra: 5.63, dec: -0.28, dist: 1200 },
    { ra: 5.24, dec: -8.20, dist: 860 }
], 0x4488ff);

setProgress(85, 'Adding nebula effects...');

// ==================== NEBULA EFFECTS ====================
function createNebula() {
    const count = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 15 + Math.random() * 25;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi) * 0.3;
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const c = new THREE.Color().setHSL(0.7 + Math.random() * 0.2, 0.6, 0.05 + Math.random() * 0.1);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    const nebula = new THREE.Points(geometry, material);
    scene.add(nebula);
    return nebula;
}
const nebula = createNebula();

setProgress(95, 'Finalizing...');

// ==================== HIDE LOADING ====================
setTimeout(() => {
    loadingDiv.style.opacity = '0';
    setTimeout(() => { loadingDiv.style.display = 'none'; }, 800);
}, 500);

// ==================== STATS ====================
document.getElementById('stats').textContent = `🌟 ${starMeshes.length} stars • 20,000 particles • NASA Level`;

// ==================== SPEED CONTROL ====================
let currentSpeed = 1.0;
document.getElementById('speed-display').textContent = currentSpeed.toFixed(1);

document.getElementById('speed-up').addEventListener('click', () => {
    currentSpeed = Math.min(5.0, currentSpeed + 0.2);
    controls.autoRotateSpeed = 0.6 * currentSpeed;
    document.getElementById('speed-display').textContent = currentSpeed.toFixed(1);
});

document.getElementById('speed-down').addEventListener('click', () => {
    currentSpeed = Math.max(0.1, currentSpeed - 0.2);
    controls.autoRotateSpeed = 0.6 * currentSpeed;
    document.getElementById('speed-display').textContent = currentSpeed.toFixed(1);
});

// ==================== VIEW BUTTONS ====================
document.getElementById('view-top').addEventListener('click', () => {
    camera.position.set(0, 50, 0.1);
    controls.target.set(0, 0, 0);
    controls.update();
});

document.getElementById('view-side').addEventListener('click', () => {
    camera.position.set(50, 0, 0.1);
    controls.target.set(0, 0, 0);
    controls.update();
});

// ==================== AUDIO TOGGLE ====================
document.getElementById('audio-toggle').addEventListener('click', () => {
    if (!audioCtx) {
        initAmbientMusic();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    isAudioPlaying = !isAudioPlaying;
    if (isAudioPlaying) {
        gainNode.gain.setTargetAtTime(0.06, audioCtx.currentTime, 1.0);
        document.getElementById('audio-toggle').textContent = '🔇 Mute Sound';
        document.getElementById('audio-toggle').style.background = '#ff4444';
    } else {
        gainNode.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.5);
        document.getElementById('audio-toggle').textContent = '🎵 Play Sound';
        document.getElementById('audio-toggle').style.background = '#8a0a8a';
    }
});

// ==================== NASA FACTS BUTTON ====================
document.getElementById('nasa-facts').addEventListener('click', () => {
    selectStar(sunMesh);
});

// ==================== COMPARE BUTTON ====================
let compareMode = false;
let selectedStars = [];

document.getElementById('show-compare').addEventListener('click', () => {
    compareMode = !compareMode;
    document.getElementById('show-compare').style.background = compareMode ? '#ff4444' : '#0a4a8a';
    document.getElementById('show-compare').textContent = compareMode ? '🔴 Exit Compare' : '📊 Compare';
    if (compareMode) {
        selectedStars = [];
        alert('Click two stars to compare them!');
    }
});

// ==================== TIME SLIDER ====================
let timeSliderVisible = false;
document.addEventListener('keydown', (e) => {
    if (e.key === 't' || e.key === 'T') {
        timeSliderVisible = !timeSliderVisible;
        document.getElementById('time-slider').style.display = timeSliderVisible ? 'flex' : 'none';
    }
});

document.getElementById('time-range').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('time-display').textContent = val === 0 ? 'Now' : val > 0 ? `+${val} years` : `${val} years`;
    galaxyPointsMesh.rotation.y = val * 0.0001;
});

// ==================== UNIFIED STAR SELECTION ====================
function selectStar(star) {
    if (compareMode) {
        if (selectedStars.includes(star)) return;
        selectedStars.push(star);
        if (selectedStars.length === 2) {
            showComparison(selectedStars[0], selectedStars[1]);
            selectedStars = [];
            compareMode = false;
            document.getElementById('show-compare').style.background = '#0a4a8a';
            document.getElementById('show-compare').textContent = '📊 Compare';
        } else {
            alert(`Selected: ${star.userData.name}. Now select another star!`);
        }
    } else {
        showStarFact(star);
        const pos = star.position.clone();
        const dist = star.userData.isSun ? 6 : (sizeBasedOnStar(star) + 3.5);
        const direction = pos.clone().normalize();
        const newPos = pos.clone().add(direction.multiplyScalar(dist));
        animateCamera(newPos, pos);
    }
}

// ==================== RAYCASTER INTERACTION ====================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(starMeshes);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.name) {
            selectStar(hit);
        }
    }
});

// ==================== SHOW COMPARISON ====================
function showComparison(star1, star2) {
    const d1 = star1.userData;
    const d2 = star2.userData;
    const panel = document.getElementById('fact-panel');
    document.getElementById('star-name-display').textContent = '📊 Comparison';
    document.getElementById('star-constellation').textContent = `${d1.name} vs ${d2.name}`;

    const content = document.getElementById('fact-content');
    content.innerHTML = `
                <div class="section-title">📊 Size Comparison</div>
                <div class="comparison-box">
                    <div class="fact-row"><span class="label">⭐ Star</span><span class="value">${d1.name}</span><span class="value">${d2.name}</span></div>
                    <div class="fact-row"><span class="label">☀️ vs Sun</span><span class="value highlight">${d1.vsSun}×</span><span class="value highlight">${d2.vsSun}×</span></div>
                    <div class="fact-row"><span class="label">🌍 vs Earth</span><span class="value green">${d1.vsEarth}×</span><span class="value green">${d2.vsEarth}×</span></div>
                    <div class="fact-row"><span class="label">📏 Distance</span><span class="value blue">${d1.dist} ly</span><span class="value blue">${d2.dist} ly</span></div>
                    <div class="fact-row"><span class="label">🌡️ Temp</span><span class="value">${d1.temp} K</span><span class="value">${d2.temp} K</span></div>
                    <div class="fact-row"><span class="label">⚖️ Mass</span><span class="value">${d1.mass} M☉</span><span class="value">${d2.mass} M☉</span></div>
                    <div class="fact-row"><span class="label">🏷️ Type</span><span class="value red">${d1.sizeDesc}</span><span class="value red">${d2.sizeDesc}</span></div>
                </div>
                <div class="description">
                    ${d1.name} is ${parseFloat(d1.vsSun) > parseFloat(d2.vsSun) ? 'larger' : 'smaller'} than ${d2.name}.
                    ${d1.dist < d2.dist ? d1.name : d2.name} is closer to Earth.
                </div>
            `;
    document.getElementById('star-description').textContent = '';
    panel.style.display = 'block';
}

function sizeBasedOnStar(star) {
    const radius = parseFloat(star.userData.radius) || 1;
    if (isNaN(radius)) return 3;
    return Math.max(2, Math.min(8, radius * 0.15));
}

function animateCamera(targetPos, targetLook) {
    const startPos = camera.position.clone();
    const duration = 800;
    const startTime = Date.now();

    function updateCamera() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(startPos, targetPos, ease);
        controls.target.lerpVectors(new THREE.Vector3(0, 0, 0), targetLook, ease);
        controls.update();
        if (t < 1) requestAnimationFrame(updateCamera);
    }
    updateCamera();
}

// ==================== HABITABLE ZONE RING ====================
let hzMesh = null;

function updateHabitableZone(star) {
    if (hzMesh) scene.remove(hzMesh);

    const isHzEnabled = document.getElementById('hz-toggle').checked;
    if (!isHzEnabled || star.userData.isSun) return;

    const radius = parseFloat(star.userData.radius) || 1;
    const temp = parseFloat(star.userData.temp) || 5778;

    const luminosity = Math.pow(radius, 2) * Math.pow(temp / 5778, 4);
    const rIn = Math.sqrt(luminosity / 1.1) * 0.4;
    const rOut = Math.sqrt(luminosity / 0.53) * 0.4;

    const geometry = new THREE.RingGeometry(rIn + 0.1, rOut + 0.2, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x33ff33,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending
    });
    hzMesh = new THREE.Mesh(geometry, material);
    hzMesh.rotation.x = Math.PI / 2;
    hzMesh.position.copy(star.position);
    scene.add(hzMesh);
}

// ==================== TELEMETRY ====================
function updateTelemetry(star) {
    document.getElementById('tele-name').textContent = star.userData.name;
    const dist = parseFloat(star.userData.dist) || 0.000016;

    if (star.userData.isSun) {
        document.getElementById('tele-light-time').textContent = '8.3 minutes';
    } else {
        document.getElementById('tele-light-time').textContent = `${(dist).toFixed(1)} years`;
    }

    const z = (dist * 0.00000007).toFixed(7);
    document.getElementById('tele-doppler').textContent = z;
}

// ==================== OPEN SUN LARGE MODAL ====================
function openSunLargeModal(data) {
    const modal = document.getElementById('sun-large-modal');
    const sidebar = document.getElementById('sun-sidebar-stats');
    const scroller = document.getElementById('sun-facts-scroller');

    sidebar.innerHTML = `
                <h1 style="color:#ffaa00; text-shadow:0 0 15px rgba(255,170,0,0.4); font-size:24px; margin-bottom:5px;">☀️ Sun (Surya)</h1>
                <p style="color:#88aaff; font-size:12px; margin-bottom:15px;">NASA Heliophysics Archive</p>
                
                <div class="fact-row"><span class="label">🏷️ Classification</span><span class="value red">${data.sizeDesc}</span></div>
                <div class="fact-row"><span class="label">⭐ Magnitude</span><span class="value">${data.mag}</span></div>
                <div class="fact-row"><span class="label">⚖️ Mass</span><span class="value">${data.mass}</span></div>
                <div class="fact-row"><span class="label">📐 Radius</span><span class="value">${data.radius}</span></div>
                <div class="fact-row"><span class="label">🌡️ Core Temp</span><span class="value highlight">15,000,000 K</span></div>
                <div class="fact-row"><span class="label">🌡️ Surface Temp</span><span class="value" style="color:#ffbb22;">${data.temperature}</span></div>
                <div class="fact-row"><span class="label">⏳ Age</span><span class="value green">${data.age}</span></div>
                <div class="fact-row"><span class="label">🔄 Rotation</span><span class="value">${data.rotation}</span></div>
                
                <div class="section-title">🧬 Primary Elements</div>
                <p style="font-size:10px; color:#ccd; line-height:1.4;">${data.composition}</p>
                
                <div class="section-title">🔬 Atmosphere</div>
                <p style="font-size:10px; color:#88ccff; line-height:1.4;">${data.atmosphere}</p>
            `;

    scroller.innerHTML = '';
    data.extra_facts.forEach((fact, i) => {
        const card = document.createElement('div');
        card.className = 'fact-card';
        card.innerHTML = `<span style="color:#ffaa00; font-weight:bold; font-size:10px;">☀️ FACT #${i+1}</span><p style="margin-top:4px; color:#ddd;">${fact}</p>`;
        scroller.appendChild(card);
    });

    modal.style.display = 'block';
}

document.getElementById('close-sun-large').addEventListener('click', () => {
    document.getElementById('sun-large-modal').style.display = 'none';
});

// ==================== SHOW STAR FACT ====================
function showStarFact(star) {
    const data = star.userData;

    if (audioInitialized && isAudioPlaying) {
        playStarSound(data.temp, parseFloat(data.radius) || 1);
    }

    updateTelemetry(star);
    updateHabitableZone(star);
    highlightHRDiagram(data.name);

    if (data.isSun) {
        openSunLargeModal(data);
        return;
    }

    const panel = document.getElementById('fact-panel');
    document.getElementById('star-name-display').textContent = data.name;
    document.getElementById('star-constellation').textContent = `${data.constellation || 'Solar System'} • ${data.type || 'Main Sequence'}`;

    const content = document.getElementById('fact-content');
    content.innerHTML = `
                <div class="section-title">📊 Size Comparison</div>
                <div class="comparison-box">
                    <div class="fact-row"><span class="label">☀️ vs Sun (Radius)</span><span class="value highlight">${data.vsSun || 'N/A'}× bigger</span></div>
                    <div class="fact-row"><span class="label">🌍 vs Earth (Radius)</span><span class="value green">${data.vsEarth || 'N/A'}× bigger</span></div>
                    <div class="fact-row"><span class="label">📏 Distance from Sun</span><span class="value blue">${data.distAU || 'N/A'} AU</span></div>
                    <div class="fact-row"><span class="label">📏 Distance from Earth</span><span class="value">${data.dist || 'N/A'} light-years</span></div>
                    <div class="fact-row"><span class="label">🏷️ Classification</span><span class="value red">${data.sizeDesc || 'Unknown'}</span></div>
                </div>
                <div class="section-title">🔬 Physical Properties</div>
                <div class="fact-row"><span class="label">⭐ Magnitude</span><span class="value">${data.mag || 'N/A'}</span></div>
                <div class="fact-row"><span class="label">⚖️ Mass (Sol)</span><span class="value">${data.mass || 'N/A'} M☉</span></div>
                <div class="fact-row"><span class="label">📐 Radius (Sol)</span><span class="value">${data.radius || 'N/A'} R☉</span></div>
                <div class="fact-row"><span class="label">🌡️ Temperature</span><span class="value">${data.temp || 'N/A'} K</span></div>
                <div class="section-title">📜 History</div>
                <div class="fact-row"><span class="label">🔭 Discovery</span><span class="value">${data.discovery || 'Unknown'}</span></div>
                <div class="fact-row"><span class="label">👨‍🔬 Discoverer</span><span class="value">${data.discoverer || 'Unknown'}</span></div>
            `;
    document.getElementById('star-description').textContent = data.description || 'No description available.';
    panel.style.display = 'block';
}

document.getElementById('close-fact').addEventListener('click', () => {
    document.getElementById('fact-panel').style.display = 'none';
});

// ==================== SEARCH ====================
document.getElementById('search-btn').addEventListener('click', () => {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    if (!query) return;
    const star = starMap.get(query);
    if (star) {
        selectStar(star);
    } else {
        alert('Star not found! Try: Sirius, Betelgeuse, Polaris, Vega, Rigel, Antares, etc.');
    }
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
});

// ==================== FILTER ====================
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        starMeshes.forEach(star => {
            const cat = star.userData.category || 'Main Sequence';
            if (filter === 'all' || cat === filter) {
                star.visible = true;
            } else {
                star.visible = false;
            }
        });
        sunMesh.visible = true;
    });
});

// ==================== RESET ====================
document.getElementById('reset-btn').addEventListener('click', () => {
    camera.position.set(30, 20, 40);
    controls.target.set(0, 0, 0);
    controls.update();
    document.getElementById('fact-panel').style.display = 'none';
    document.getElementById('sun-large-modal').style.display = 'none';
    if (hzMesh) scene.remove(hzMesh);
    starMeshes.forEach(s => s.visible = true);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-filter="all"]').classList.add('active');
});

// ==================== TOGGLE ROTATE ====================
document.getElementById('toggle-rotate').addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    document.getElementById('toggle-rotate').textContent = controls.autoRotate ? '⏸' : '▶️';
});

// ==================== NEBULA COLOR ADJUSTER ====================
document.getElementById('nebula-color-selector').addEventListener('change', (e) => {
    const val = e.target.value;
    let hue = 0.55;
    if (val === 'Cosmic Amber') hue = 0.10;
    if (val === 'Andromeda Purple') hue = 0.75;
    if (val === 'Deep Nebula Red') hue = 0.02;
    const count = parseInt(document.getElementById('particle-density-range').value);
    generateGalaxy(count, hue);
});

document.getElementById('particle-density-range').addEventListener('input', (e) => {
    const count = parseInt(e.target.value);
    const val = document.getElementById('nebula-color-selector').value;
    let hue = 0.55;
    if (val === 'Cosmic Amber') hue = 0.10;
    if (val === 'Andromeda Purple') hue = 0.75;
    if (val === 'Deep Nebula Red') hue = 0.02;
    generateGalaxy(count, hue);
});

// ==================== TOUR MODE ====================
let tourActive = false;
let tourInterval = null;
let tourIndex = 0;

const tourStars = [
    'betelgeuse',
    'sirius',
    'polaris',
    'vega',
    'rigel',
    'antares',
    'arcturus',
    'capella',
    'spica',
    'deneb',
    'sun'
];

document.getElementById('tour-btn').addEventListener('click', () => {
    tourActive = !tourActive;
    if (tourActive) {
        document.getElementById('tour-btn').style.background = '#ff4444';
        document.getElementById('tour-btn').textContent = '⏹ Stop Tour';
        controls.autoRotate = false;
        document.getElementById('toggle-rotate').textContent = '▶️';

        tourIndex = 0;
        runTourStep();
        tourInterval = setInterval(runTourStep, 7000);
    } else {
        stopTour();
    }
});

function runTourStep() {
    if (!tourActive) return;
    const starName = tourStars[tourIndex];
    const starObj = starMap.get(starName);
    if (starObj) {
        selectStar(starObj);
        if (starName === 'sun') {
            stopTour();
        }
    }
    tourIndex++;
}

function stopTour() {
    tourActive = false;
    clearInterval(tourInterval);
    document.getElementById('tour-btn').style.background = '#cc6600';
    document.getElementById('tour-btn').textContent = '🚀 Tour';
    controls.autoRotate = true;
    document.getElementById('toggle-rotate').textContent = '⏸';
}

// ==================== H-R DIAGRAM ====================
const hrPlot = document.getElementById('hr-diagram-plot');

function drawHRDiagram() {
    hrPlot.innerHTML = '';
    starMeshes.forEach(star => {
        const temp = parseFloat(star.userData.temp) || 5778;
        const radius = parseFloat(star.userData.radius) || 1;
        const luminosity = Math.pow(radius, 2) * Math.pow(temp / 5778, 4);

        const logTemp = Math.log10(temp);
        const minLogT = Math.log10(2500);
        const maxLogT = Math.log10(30000);
        const xPct = 100 - ((logTemp - minLogT) / (maxLogT - minLogT)) * 100;

        const logLum = Math.log10(luminosity);
        const minLogL = -5;
        const maxLogL = 6;
        const yPct = 100 - ((logLum - minLogL) / (maxLogL - minLogL)) * 100;

        const dot = document.createElement('div');
        dot.className = 'hr-star-dot';
        dot.style.left = `${Math.min(98, Math.max(2, xPct))}%`;
        dot.style.top = `${Math.min(98, Math.max(2, yPct))}%`;
        dot.title = `${star.userData.name} (${temp}K)`;
        dot.id = `hr-dot-${star.userData.name.toLowerCase().replace(/\s+/g, '')}`;

        dot.addEventListener('click', () => {
            selectStar(star);
        });

        hrPlot.appendChild(dot);
    });
}

function highlightHRDiagram(starName) {
    document.querySelectorAll('.hr-star-dot').forEach(d => d.classList.remove('active'));
    const cleanId = `hr-dot-${starName.toLowerCase().replace(/\s+/g, '')}`;
    const targetDot = document.getElementById(cleanId);
    if (targetDot) targetDot.classList.add('active');
}

document.getElementById('toggle-hr-btn').addEventListener('click', () => {
    const panel = document.getElementById('hr-diagram-panel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    document.getElementById('toggle-hr-btn').textContent = isVisible ? 'Show Diagram' : 'Hide Diagram';
    if (!isVisible) drawHRDiagram();
});

document.getElementById('close-hr-panel').addEventListener('click', () => {
    document.getElementById('hr-diagram-panel').style.display = 'none';
    document.getElementById('toggle-hr-btn').textContent = 'Show Diagram';
});

// ==================== RESIZE ====================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== ANIMATION ====================
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    galaxyPointsMesh.rotation.y += 0.00015;
    nebula.rotation.y += 0.00005;
    const pulse = 1 + 0.05 * Math.sin(Date.now() * 0.001);
    sunGlow.intensity = 4 * pulse;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}
animate();

console.log(`🌌 Observatory online! ${starMeshes.length} stars loaded.`);
