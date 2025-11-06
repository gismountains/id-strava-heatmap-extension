const fs = require('fs');
const fsExtra = require('fs-extra'); 
const archiver = require('archiver'); 
const path = require('path');
const { program } = require('commander');
const { execSync } = require('child_process');

const DIST = path.join(process.cwd(), 'dist');
const MANIFEST = 'manifest.json';
const FOLDERS = ['icons', 'lib', 'src'];

// Function to copy shared files
function copySharedFiles() {
  FOLDERS.forEach((folder) => {
    const source = path.join('.', folder);
    const destination = path.join(DIST, folder);
    console.log(`Copying ${source} to ${destination}`);
    fsExtra.copySync(source, destination);
  });
}

// Function to create a zip file
function createZip(zipFileName, manifest) {
  fs.writeFileSync(path.join(DIST, MANIFEST), JSON.stringify(manifest, null, 2));

  const output = fs.createWriteStream(path.join(DIST, zipFileName));
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`${zipFileName} created successfully! (${archive.pointer()} total bytes)`);
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);

  // Add manifest file
  archive.file(path.join(DIST, MANIFEST), { name: MANIFEST });

  // Add folders
  FOLDERS.forEach((folder) => {
    const folderPath = path.join(DIST, folder);
    if (fs.existsSync(folderPath)) {
      archive.directory(folderPath, folder);
    } else {
      console.warn(`Warning: Folder "${folder}" does not exist. Skipping.`);
    }
  });

  archive.finalize();
}

// Function to clean up the dist folder
function cleanUp() {
  const filesToDelete = [path.join(DIST, MANIFEST)];
  const foldersToDelete = FOLDERS.map((folder) => path.join(DIST, folder));

  [...filesToDelete, ...foldersToDelete].forEach((item) => {
    if (fs.existsSync(item)) {
      fsExtra.removeSync(item); // Use fs-extra to remove files and directories
      console.log(`Deleted: ${item}`);
    } else {
      console.warn(`Warning: ${item} does not exist. Skipping.`);
    }
  });
}

// Read the original manifest file
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
const { version } = manifest;

// Generate zip filenames
const chromeZip = `${version}-chrome.zip`;
const firefoxZip = `${version}-firefox.zip`;

// Set up the CLI options
const options = program
  .option('-f, --force', 'Force recreate zip even if version already exists')
  .parse(process.argv)
  .opts();

// make sure dist folder exists, if not create it
if (!fs.existsSync(DIST)) {
  fs.mkdirSync(DIST);
}

// Check if version already exists
if (fs.existsSync(path.join(DIST, chromeZip))) {
  if (options.force) {
    fs.rmSync(path.join(DIST, chromeZip));
  } else {
    console.log(
      `Chrome Version ${version} already exists - bump version first or use --force option.`
    );
    process.exit(1);
  }
}

if (fs.existsSync(path.join(DIST, firefoxZip))) {
  if (options.force) {
    fs.rmSync(path.join(DIST, firefoxZip));
  } else {
    console.log(
      `Firefox Version ${version} already exists - bump version first or use --force option.`
    );
    process.exit(1);
  }
}

// Copy shared files to dist folder
copySharedFiles();

// Create Chrome build
const manifestChrome = { ...manifest };
createZip(chromeZip, manifestChrome);

// Create Firefox build
const manifestFirefox = Object.fromEntries(
  Object.entries({
    ...manifest,
    ...JSON.parse(fs.readFileSync('manifest-firefox.json', 'utf-8')),
  }).filter(([, value]) => value !== null)
);
createZip(firefoxZip, manifestFirefox);

// Clean up dist folder
cleanUp();

console.log(`Chrome and Firefox v${version} builds created successfully!`);
