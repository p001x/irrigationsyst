# AgriAdapt: Empowering Climate-Resilient Agriculture

## What Inspired Me
The increasing volatility of global weather patterns and the critical threat it poses to agricultural stability inspired the creation of AgriAdapt. Smallholder farmers, regional planners, and agricultural districts often lack the high-fidelity, real-time data needed to make informed decisions about crop health and resource allocation. I wanted to bridge the gap between complex satellite telemetry and actionable insights, creating a centralized, easy-to-use dashboard that empowers stakeholders to monitor, predict, and adapt to climate challenges effectively. 

## How I Built It
AgriAdapt is designed as a dynamic, real-time web application built from the ground up using HTML, CSS, and Vanilla JavaScript. This approach ensures a lightweight, highly performant user experience without the overhead of heavy frameworks. 

The architecture is driven by three core interactive pillars:
1. **Member Analysis Hub**: A responsive, data-rich matrix that evaluates constituent performance and visualizes vital agricultural indices.
2. **Reporting Hub**: An automated reporting engine that continuously audits member performance metrics in real-time, flagging at-risk fields and reducing manual oversight.
3. **Validation Lab**: A dedicated testing environment to run automated audits, identify missing data points, and validate data rendering logic.

The system processes simulated high-fidelity satellite metrics and calculates crucial resilience indicators natively in the frontend to provide immediate AI-driven insights to stakeholders.

## The Math Behind the Metrics
To provide accurate health monitoring and predictive insights, AgriAdapt relies on standard vegetative and atmospheric indices. The system evaluates these metrics to determine district-level resilience:

### Normalized Difference Vegetation Index (NDVI)
NDVI is used to quantify vegetation greenness and understand vegetation density and overall crop health. It is calculated using the near-infrared and red bands of satellite imagery:
$$ NDVI = \frac{NIR - Red}{NIR + Red} $$
Where $NIR$ is Near-Infrared reflectance and $Red$ is red band reflectance.

### Water Requirements Satisfaction Index (WRSI)
WRSI is a critical indicator for assessing drought stress and predicting crop yield reductions over a growing season:
$$ WRSI = \left( \frac{\sum AET}{\sum WR} \right) \times 100 $$
Where $AET$ is Actual Evapotranspiration and $WR$ is the crop Water Requirement.

### Standardized Precipitation Index (SPI)
SPI is a probability index that gives a localized representation of abnormal wetness and dryness, crucial for early drought warning:
$$ SPI = \frac{x_i - \bar{x}}{\sigma} $$
Where $x_i$ is the precipitation for a given period, $\bar{x}$ is the long-term mean precipitation, and $\sigma$ is the standard deviation.

## What I Learned
Through developing AgriAdapt, I significantly deepened my understanding of data visualization and asynchronous state management within vanilla JavaScript. Managing real-time, district-wide data streams required optimizing the Document Object Model (DOM) to prevent layout thrashing and rendering bottlenecks, especially within complex panels. I also gained invaluable experience in UI/UX design—specifically, how to present dense scientific metrics in an intuitive, high-contrast, and stakeholder-friendly interface that feels premium and responsive.

## Challenges Faced
The primary challenge during development was stabilizing the dashboard's rendering logic. Early on, structural constraints and uninitialized state dependencies led to layout collapses and empty panels when switching between the Member Analysis and Reporting Hub views. 

Constructing a robust initialization sequence to guarantee that data dependencies were fully met before rendering the DOM was crucial. Additionally, ensuring our custom CSS layout could handle dynamic, asynchronous data injection without breaking the responsive grid required meticulous debugging and refinement. Overcoming these hurdles ultimately resulted in a much more resilient and reliable application architecture.

## Built With
* **Core Languages**: HTML5, CSS3, Vanilla JavaScript
* **Geospatial & Mapping**: Leaflet.js, Turf.js, Leaflet-Geoman
* **Data Processing**: shpjs (Shapefile integration), GeoTIFF.js (Client-side satellite band processing)
* **Design & Typography**: FontAwesome, Google Fonts (*Cabinet Grotesk*, *Instrument Serif*, *Space Mono*)
* **External APIs & Datasets**: NASA GIBS WMS (Web Map Service) for live MODIS imagery, CHIRPS v2.0 & ERA5-Land (Environmental Datasets)
* **Machine Learning**: XGBoost (simulated/referenced for mid-season anomaly prediction)
