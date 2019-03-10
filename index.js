const parser = require('./parser');

/**
 * Start function
 *
 * @returns {Promise<void>}
 */
async function start() {
  try {
    const ads = await parser('LINK TO PARSE PUT HERE');
    console.log(ads);
  } catch (e) {
    console.log(e);
  }

  process.exit(0);
}

start();