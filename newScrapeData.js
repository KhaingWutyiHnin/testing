async newScrapeData() {

	/* Define required arrays */
	let errUrls = [],
		errTransUrls = [],
		scrapeCompany = [],
		errSite = [],
		errDate = [];

	/* Define required variables */
	let noOfUrls = 0,
		noOfErrUrls = 0,
		noOfNoscrapingUrls = 0,
		noOfscrapingUrls = 0,
		noOfInsert = 0,
		noOfInsertErr = 0,
		noOfTranslation = 0,
		noOfTransErr = 0,
		noOfErrTitle = 0,
		noOfErrLink = 0,
		noOfErrSite = 0,
		noOfErrDate = 0,
		noOfTrueUrl = 0,
		noOfFalseUrl = 0;
	
	/*　Define Date */
	let todayDate = new Date();
	let yesterdayDate = new Date(todayDate);
	yesterdayDate.setDate(yesterdayDate.getDate() - 1);

	/* Change ISO format */
	todayDate = todayDate.toISOString().slice(0, 10);
	yesterdayDate = yesterdayDate.toISOString().slice(0, 10);

	/* Get Not RSS URLs */
	let rssUrls = this.getRssUrls('https://dxdailypost.com/api/not-rss-ur-ls?_sort=id:ASC&_limit=-1');

	/* Loop the URLs */
	rssUrls.then(async function(rssUrl) {
		/* Define browser and page */
		const browser = await puppeteer.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});
		const [page] = await browser.pages();

		try {
			/* Start for loop */
			for (const x in rssUrl) {
				/* Count no of URL */
				noOfUrls++;

				/* Check Testing Scraping
				if (rssUrl[x].test_scraping) {
					noOfTrueUrl++;
				} else {
					noOfFalseUrl++;
				}

				/* Get Scrape Company Name */
				let companyName = rssUrl[x].CompanyName;
				scrapeCompany.push(companyName);

				/* Get Company ID */
				let relatedCompany = rssUrl[x].id;

				/* Set Timeout */
				await page.setDefaultNavigationTimeout(0);

				/* Wait 2 min for navigation timeout */
				try {
					await page.goto(rssUrl[x].NewsroomPageUrl, {
						timeout: 120000
					});
				} catch (e) {
					errSite.push(companyName);
					noOfErrSite++;
					continue;
				}

				/* Wait 1 min for selector to appear in page */
				let selector = rssUrl[x].TitleClassName + ", " + rssUrl[x].UrlClassName + ", " + rssUrl[x].DateClassName;
				try {
					await page.waitForSelector(selector, {
						timeout: 60000
					});
				} catch (e) {
					if (e instanceof puppeteer.errors.TimeoutError) {
						errUrls.push(companyName);
						noOfErrUrls++;
						continue;
						}
				}

				/* Get Title */
				let attr = await page.$$eval(rssUrl[x].TitleClassName, (el) => el.map((x) => x.textContent).slice(0, 1));
				if (!attr.length) {
					noOfErrTitle++;
				}

				/* Get Link */
				let elementHandles = await page.$$(rssUrl[x].UrlClassName);
				let propertyJsHandles = await Promise.all(elementHandles.map((handle) => handle.getProperty("href")));
				let hrefs2 = await Promise.all(propertyJsHandles.map((handle) => handle.jsonValue()).slice(0, 1));
				if (!hrefs2.length) { 
					noOfErrLink++;
				}

				/* Get Date */
				let dates = await page.$$eval(rssUrl[x].DateClassName, (el) => el.map((x) => x.textContent).slice(0, 1));

				/* Parses the string representation of Date*/
				let timestamp = Date.parse(dates);

				/* Check Title, Link and Date */
				if (attr.length && hrefs2.length && dates.length) {
					let title = attr.toString();
					let link = hrefs2.toString();

					/* Checke Timestamp is NaN */
					if (isNaN(timestamp) != false) {
						noOfErrDate++;
						errDate.push(companyName);
						continue;
					}

					/* Change ISO Format */
					let date = new Date(dates).toISOString().slice(0, 10);

					/* For the title that has no year in date field */
					let dateArr = date.split("-");
					if (dateArr[0] === '2001') {
						let currentYear = new Date().getFullYear();
						date = currentYear + '-' + dateArr[1] + '-' + dateArr[2];
					}

					/* Check is Date is Today or Yesterday, Check testing scraping is on */
					if (date == todayDate || date == yesterdayDate || rssUrl[x].test_scraping) {
						noOfscrapingUrls++;

						/* Check blank space in title */
						title = title.replace(regex, "");
						title = title.trim(title);

						/* Define URL for translate */
						let url = base_url + sourceLanguage + "&tl=" + targetLanguage + "&dt=t&q=" + encodeURI(title.replace("&", " ％26").replace("#", " ％23").replace("?", " ％3F").replace("!", " ％33").replace("|", " ％7C").replace(";", " ％3B").replace(".", " ％2E"));

						/* Translate title */
						let jpTitle = fetch(url)
							.then(response => response.json())
							.then(data => {
								noOfTranslation++;
								return data[0][0][0];
							})
							.catch((error) => {
								noOfTransErr++;
								errTransUrls.push(companyName);
							});

						/* Get Translated Data */
						jpTitle.then(data => {
							/* Check special characters */
							data = data.replace("％26", "＆").replace("％23", "＃").replace("％3F", "？").replace("％33", "！").replace("％7C", "｜").replace("％3B", "；").replace("％2E", "。");

							fetch('https://dxdailypost.com/api/scraping-data', {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify({
									companyname: companyName,
									link: link,
									engtitle: title,
									newstitle: data,
									releasedate: date,
									not_rss_ur_l: relatedCompany,
								})

							})
							.then(response => {
								if (response.ok) {
									noOfInsert++;
									response.json();
								}
							})
							.then(data => console.log(data))
							 .catch((error) => {
							 	noOfInsertErr++;
							 })
						});
					}
				} else {
					errUrls.push(companyName);
					noOfErrUrls++;
				}

			}
			/* End for loop */
		} catch (err) {
			console.log(err);
		} finally {
			await browser.close();
		}

		/* Put Scraping Result */
		let scrapingResultUrl, scrapingResultTitle;
		if (noOfFalseUrl > 0) {
			scrapingResultUrl = "https://dxdailypost.com/api/scraping-results";
			scrapingResultTitle = "Not RSS Scraping";

		} else {
			scrapingResultUrl = "https://dxdailypost.com/api/testing-scraping-results";
			scrapingResultTitle = "Testing Scraping";
		}
		fetch(scrapingResultUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				 Date: todayDate,
				 Name: scrapingResultTitle,
				 Error: {
				 	"Translation Error Title": errTransUrls,
				 	"Number of error translation record": noOfTransErr,
				 	"Number of error Insertion record": noOfInsertErr,
				 	"Scraping Error Companies Names": errUrls,
				 	"Number of Error Urls": noOfErrUrls,
				 	"Number of Error Date": noOfErrDate,
				 	"Date format Error Companies": errDate,
				 	"Number of Site Error": noOfErrSite,
				 	"Site Error Companies": errSite
				 },
				 Result: {
				 	"Today's translation record": noOfTranslation,
				 	"Today's insertion record": noOfInsert,
				 	"Today's News Urls": noOfscrapingUrls,
				 	"Total Scraping Companies": scrapeCompany,
				 	"Total Scraping URLs": noOfUrls,
				 	"Number of test_scraping FALSE URL": noOfFalseUrl,
				 	 "Number of test_scraping TRUE URL": noOfTrueUrl
				 }

			})
		})
		.then(response => response.json())
		.then(data => console.log(data));
	});
}