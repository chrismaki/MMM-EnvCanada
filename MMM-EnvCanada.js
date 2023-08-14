/* MagicMirror²
 * Module: EnvCanada
 *
 * By Charles Morris
 * some material based on envcanada provider for default Weather Module
 * version 1.0 August 2023
 * MIT Licensed.
 * 
 * Module displays current alert warnings and current textweather 
 * forecast from Environment Canada for configured location for today
 * and tonight, or for tonight and tomorrow.
 * 
 * If configured, also displays Environment Canada forecast for 5 days,
 * showing two lines for "today" and "tonight" forecasts (Weather Module only 
 * shows one line)
 * 
 * If configured, also displays Marine Wind forecast
 */
 
var locationHeader = "";
var	forecast = "Starting ...";
var marine = "";
var airquality = "";
var airQI = "";
var airQIStat = "low";
var airQIF = "";
var airQIFStat = "low";
var myType = "day-sunny";
var days = [];
 
Module.register("MMM-EnvCanada", {
	// Default module config.
	defaults: {
		updateInterval: 10 * 60 * 1000,
		siteCode: "s1234567",
		provCode: "ON",
		language: "e",
		textForecasts: 2,
		showAlerts: true,
		showForecastDays: 5,
		marineRegion: "",
		marineSubRegion: "",
		marineLocation: "",
		marineStartMonth: 5,
		marineEndMonth: 10,
		airQualityProv: "",
		airQualityRegion: ""
	},
	
	start() {
		setInterval(() => {
			this.getForecast();
			}, this.config.updateInterval);
		if (this.config.language != "f") this.config.language = "e";
		if (this.config.textForecasts > 6) this.config.textForecasts = 6;
		if (this.config.showForecastDays > 6) this.config.showForecastDays = 6;
		if (this.config.marineStartMonth < 1) this.config.marineStartMonth = 1;
		if (this.config.marineEndMonth > 12) this.config.marineEndMonth = 12;
		if (this.data.header) locationHeader = this.data.header;
		this.getForecast();
	},
	
	getStyles() {
		return ["weather-icons.css", "MMM-EnvCanada.css"];
	},
	
	getScripts() {
		return ["forecastdata.js"];
	},
	
	getTemplate() {
		return "MMM-EnvCanada.njk";
	},

	getTemplateData() {
		return {
			mytext: forecast,
			marine: marine,
			airquality: airquality,
			airQI: airQI,
			airQIF: airQIF,
			airQIStat: airQIStat,
			airQIFStat: airQIFStat,
			language: this.config.language,
			forecastDays: this.config.showForecastDays,
			forecast: days
			};
	},
	
	getHeader() {
		return locationHeader;
	},
	
	getForecast() {
		days.splice(0);

		performWebRequest(this.getUrl(), "xml", true, undefined, undefined)
		.then((data) => {
			if (locationHeader == "") {
				locationHeader = data.querySelector("siteData location name").textContent;
				if (this.config.language == "f") locationHeader = "Prévisions pour " + locationHeader;
				else locationHeader = "Forecast for " + locationHeader;
			}
			var forecastArray = data.querySelectorAll("siteData forecastGroup forecast");
			forecast = "";
			for (let i = 0; i < this.config.textForecasts; i += 1) {
				forecast += "<b>" + forecastArray[i].querySelector("period").getAttribute("textForecastName") + ":</b> ";
				forecast += forecastArray[i].querySelector("textSummary").textContent + " ";
			}
			
			if (this.config.showAlerts) {
				var alert = data.querySelectorAll("siteData warnings event");
				if (alert && alert.length > 0) {
					for (let i = 0; i < alert.length; i += 1) {
						if (alert[i].getAttribute("type") === "warning")  {
							forecast = "<b>" + alert[i].getAttribute("description") + "</b>. " + forecast;
						}
					}
				}
			}
			
			if (this.config.showForecastDays > 2) {
				var firstEntry = forecastArray[0].querySelector("period").getAttribute("textForecastName");
				var today = "Today";
				if (this.config.language === "f") {
					today = "Aujourd'hui";
				}
				var forecastObj = new ForecastData();
				forecastObj.date = today;
				for (let i = 0; i < 12; i += 1) {
					if ((firstEntry === today && i % 2 == 0) || (firstEntry != today && i % 2 == 1)) {
						forecastObj.date = forecastArray[i].querySelector("period").getAttribute("textForecastName");
						forecastObj.condition = this.convertWeatherType(forecastArray[i].querySelector("abbreviatedForecast iconCode").textContent);
						forecastObj.temp = forecastArray[i].querySelector("temperatures temperature").textContent + "\u00B0";
						forecastObj.pop = forecastArray[i].querySelector("abbreviatedForecast pop").textContent;
						if (forecastObj.pop > 0) forecastObj.pop += "%";
					} else {
						forecastObj.nightCondition = this.convertWeatherType(forecastArray[i].querySelector("abbreviatedForecast iconCode").textContent);
						forecastObj.nightTemp = forecastArray[i].querySelector("temperatures temperature").textContent + "\u00B0";
						forecastObj.nightPop = forecastArray[i].querySelector("abbreviatedForecast pop").textContent;
						if (forecastObj.nightPop > 0) forecastObj.nightPop += "%";
						days.push(forecastObj);
						forecastObj = new ForecastData();
					}
				}
			}
			
			this.updateDom(0);
		});
		
		if (this.config.marineRegion != "") {
			const date = new Date();
			var month = date.getMonth() + 1;
			var inPeriod = true;
			if (this.config.marineStartMonth < this.config.marineEndMonth) {
				if (month < this.config.marineStartMonth || month > this.config.marineEndMonth) inPeriod = false;
			} else {
				if (month < this.config.marineStartMonth && month > this.config.marineEndMonth) inPeriod = false;
			}
			
			if (inPeriod) performWebRequest(this.getMarineUrl(), "xml", true, undefined, undefined)
			.then((data) => {
				var warningsArray = data.querySelectorAll("marineData warnings location");
				marine = "";
				if (warningsArray && warningsArray.length > 0) {
					for (let i = 0; i < warningsArray.length; i += 1) {
						var name = warningsArray[i].getAttribute("name");
						if (!name || name === this.config.marineLocation) {
							var event = warningsArray[i].querySelector("event");
							if (event) {
								var status = event.getAttribute("status");
								if (status && (status === "EN VIGUEUR" || status === "IN EFFECT")) {
									marine += "<b>" + event.getAttribute("name") + ".</b> ";
								}
							}
						}
					}
				}
				
				var marineArray = data.querySelectorAll("marineData regularForecast location");
				if (marineArray && marineArray.length > 0) {
					for (let i = 0; i < marineArray.length; i += 1) {
						var name = marineArray[i].getAttribute("name");
						if (!name || name === this.config.marineLocation) {
							var wind = marineArray[i].querySelector("weatherCondition wind");
							marine += wind.textContent + " ";
						}
					}
				}

				if (marine != "") {
					if (this.config.language === "f") marine = "<b>Météo maritime:</b> " + marine;
					else marine = "<b>Marine Forecast:</b> " + marine;
					this.updateDom(0);
				}
			});
		}
		
		if (this.config.airQualityRegion != "") {
			performWebRequest(this.getAirQualityUrl(), "xml", true, undefined, undefined)
			.then((data) => {
				var region = data.querySelector("conditionAirQuality region");
				if (region) {
					airquality = region.getAttribute("nameEn");
					airQI = data.querySelector("conditionAirQuality airQualityHealthIndex").textContent;
					if (airQI > 6) airQIStat = "high";
					else if (airQI > 3) airQIStat = "med";
					else airQIStat = "low";
					this.updateDom(0);
				}
			});

			performWebRequest(this.getAirQualityForecastUrl(), "xml", true, undefined, undefined)
			.then((data) => {
				airQIF = data.querySelector("forecastAirQuality forecastGroup forecast airQualityHealthIndex").textContent;
					if (airQIF > 6) airQIFStat = "high";
					else if (airQIF > 3) airQIFStat = "med";
					else airQIFStat = "low";
				this.updateDom(0);
			});
		}
	},
	
	getUrl() {
		return `https://dd.weather.gc.ca/citypage_weather/xml/${this.config.provCode}/${this.config.siteCode}_${this.config.language}.xml`;
	},
	
	getMarineUrl() {
		return `https://dd.weather.gc.ca/marine_weather/xml/${this.config.marineRegion}/${this.config.marineSubRegion}_${this.config.language}.xml`;
	},
	
	getAirQualityUrl() {
		return `https://dd.weather.gc.ca/air_quality/aqhi/${this.config.airQualityProv}/observation/realtime/xml/AQ_OBS_${this.config.airQualityRegion}_CURRENT.xml`;
	},
	
	getAirQualityForecastUrl() {
		return `https://dd.weather.gc.ca/air_quality/aqhi/${this.config.airQualityProv}/forecast/realtime/xml/AQ_FCST_${this.config.airQualityRegion}_CURRENT.xml`;
	},
	
	convertWeatherType(weatherType) {
		const weatherTypes = {
			"00": "day-sunny",
			"01": "day-sunny",
			"02": "day-sunny-overcast",
			"03": "day-cloudy",
			"04": "day-cloudy",
			"05": "day-cloudy",
			"06": "day-sprinkle",
			"07": "day-showers",
			"08": "day-snow",
			"09": "day-thunderstorm",
			10: "cloud",
			11: "showers",
			12: "rain",
			13: "rain",
			14: "sleet",
			15: "sleet",
			16: "snow",
			17: "snow",
			18: "snow",
			19: "thunderstorm",
			20: "cloudy",
			21: "cloudy",
			22: "day-cloudy",
			23: "day-haze",
			24: "fog",
			25: "snow-wind",
			26: "sleet",
			27: "sleet",
			28: "rain",
			29: "na",
			30: "night-clear",
			31: "night-clear",
			32: "night-partly-cloudy",
			33: "night-alt-cloudy",
			34: "night-alt-cloudy",
			35: "night-partly-cloudy",
			36: "night-alt-showers",
			37: "night-rain-mix",
			38: "night-alt-snow",
			39: "night-thunderstorm",
			40: "snow-wind",
			41: "tornado",
			42: "tornado",
			43: "windy",
			44: "smoke",
			45: "sandstorm",
			46: "thunderstorm",
			47: "thunderstorm",
			48: "tornado"
		};

		return weatherTypes.hasOwnProperty(weatherType) ? weatherTypes[weatherType] : null;
	}
});
