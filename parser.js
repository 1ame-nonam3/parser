const request = require('request');
const cheerio = require('cheerio');
const moment = require('moment');
const readline = require('readline');

//Flag that allows to process automatically. Don't use it ;)
const AUTOMATIC = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Function to ask question to console and get answer back
 *
 * @param question
 * @returns {Promise<any>}
 */
async function askQuestion(question)
{
  return new Promise(resolve => {
    rl.question(question + ' y/n(default y)', (answer) => {
      if (AUTOMATIC || !answer || answer === 'y') {
        return resolve(true);
      }

      return resolve(false);
    });
  })
}

/**
 * Function gets page content and create Cheerio object
 *
 * @param url
 * @returns {Promise<any>}
 */
async function getPage(url)
{
  return new Promise((resolve, reject) => {
    request({
      url: url,
      headers: {
        //Don't forget about User Agent, otherwise it's possible you will be detected like a bot.
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36',
      }
    }, (error, response, body) => {
      if (error) {
        return reject(error);
      }

      //Add "decodeEntities" flag to avoid decoding entities and be able to search by selectors
      return resolve(cheerio.load(body, {decodeEntities: false}));
    });
  });
}

/**
 * Function get all ads from pages
 *
 * @param url
 * @param page
 * @returns {Promise<Array>}
 */
async function getAdsFromPage(url, page)
{
  let result = [];
  const $ = await getPage(url);

  const ads = $('#offers_table table').each((i, el) => {
    //Attention, push cheerio object to array, not Element. This will allow to search inner elements in future.
    result.push($(el));
  });

  console.log(`Page ${page}: found ${ads.length}`);
  const nextPage = $('a[data-cy="page-link-next"]');
  if (nextPage.get(0) && await askQuestion('Next page?')) {
    //Go to next page by url from "next page" buttom href
    const nextAds = await getAdsFromPage(nextPage.attr('href'), ++page);
    result = result.concat(nextAds);
  }

  return result;
}

/**
 * Function gets detailed information from ad
 *
 * @param url
 * @returns {Promise<{id: string, date: string, title: string, district: string, area: string, rooms: string, floor: string, maxFloor: string, description: string, seller:  string, photos: Array, props: Array}>}
 */
async function getDetails(url)
{
  const $ = await getPage(url);
  const title = $('div.offer-titlebox h1').text().trim();
  let district = '';
  let id = '';
  let date = '';
  let floor = '';
  let maxFloor = '';
  let rooms = '';
  let area = '';
  let description = '';
  const props = [];
  const photos = [];
  let seller = '';

  const position = $('.offer-titlebox__details strong').text().trim().split(',');
  if (position[2]) {
    district = position[2].trim();
  }

  //Temporary change locale to parse russian date
  moment.locale('ru');
  const dateParts = $('.offer-titlebox__details em').text().trim().match(/\d{1,} .+? \d{4}/);
  date = moment(dateParts[0], 'DD MMMM YYYY');
  date = date.isValid() ? date.toDate() : '';
  //Then change locale back
  moment.locale('en');

  const idParts = $('.offer-titlebox__details small').text().trim().match(/\d{6,}/);
  id = idParts[0] || '';

  $('.descriptioncontent table.item').each((i, el) => {
    const th = $(el).find('th').text().trim();
    const td = $(el).find('td').text().trim();

    if (th === 'Этаж') {
      floor = td;
    } else if (th === 'Этажность') {
      maxFloor = td;
    } else if (th === 'Количество комнат') {
      rooms = td;
    } else if (th === 'Общая площадь') {
      area = td;
    }

    props.push({key: th, value: td});
  });

  description = $('#textContent').text().trim();
  seller = $('.offer-user__details').text().trim();

  $('.photo-glow img').each((i, el) => {
    const img = $(el);
    photos.push(img.attr('src'));
  });

  return {
    id: id,
    date: date,
    title: title,
    district: district,
    area: area,
    rooms: rooms,
    floor: floor,
    maxFloor: maxFloor,
    description: description,
    seller: seller,
    photos: photos,
    props: props
  };
}

/**
 * Primary run function
 *
 * @param url
 * @returns {Promise<Array>}
 */
async function run(url)
{
  const result = [];
  const ads = await getAdsFromPage(url, 1);
  let total = ads.length;
  console.log('Total ads found: ' + ads.length);

  for (const ad of ads) {
    if (!await askQuestion('Open this ad: ' + ad.find('a.detailsLink').text().trim() + '?')) {
      console.log('left: ' + (--total) + ' ads');
      continue;
    }

    let offerData = {
      price: ad.find('.price strong').text().trim(),
      href:  ad.find('a.detailsLink').attr('href').replace(/\.html.*/, '.html')
    };

    //Get detailed info and merge data
    const details = await getDetails(offerData.href);
    offerData = Object.assign(offerData, details);

    result.push(offerData);
    console.log('left: ' + (--total) + ' ads');
  }

  return result;
}

module.exports = async function (url) {
  try {
    const ads = await run(url);
    return ads;
  } catch (e) {
    throw e;
  }
};