const FREE_MAP_API_KEY =
  "pk.eyJ1IjoiZ2FlbGR1b25nIiwiYSI6ImNrb2I1eDZ5NzIyMmEyb3MyZDlqeGRnZTAifQ.p_IcJvFNMnFDoym2YaxlGA";
const MAP_LANGUAGE = "vi";
const MAP_URL = `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?lang=${MAP_LANGUAGE}&access_token=${FREE_MAP_API_KEY}`;
const MAP_ATTRIBUTION =
  'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>';
const DEFAULT_MAP_CENTER = {
  lat: 10.80257650400078,
  lng: 106.63621277438926,
};
const DEFAULT_ZOOM_LEVEL = 15;

export { MAP_URL, MAP_ATTRIBUTION, DEFAULT_MAP_CENTER, DEFAULT_ZOOM_LEVEL };
