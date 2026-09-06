import { EmergencyServiceItem, CountryInfo } from '../store/useCountryStore';

export const ALL_WORLD_COUNTRIES: Record<string, CountryInfo> = {
  "AF": {
    code: "AF",
    name: "Afghanistan",
    flag: "🇦🇫",
    dialCode: "+93",
    primaryEmergency: "119",
    primaryLabel: 'DIAL ' + "119",
    services: [
          {
                "id": "af-emergency",
                "name": "Emergency Services (119)",
                "number": "119",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Afghanistan"
          }
    ],
  },
  "AL": {
    code: "AL",
    name: "Albania",
    flag: "🇦🇱",
    dialCode: "+355",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "al-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Albania"
          }
    ],
  },
  "DZ": {
    code: "DZ",
    name: "Algeria",
    flag: "🇩🇿",
    dialCode: "+213",
    primaryEmergency: "14",
    primaryLabel: 'DIAL ' + "14",
    services: [
          {
                "id": "dz-emergency",
                "name": "Emergency Services (14)",
                "number": "14",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Algeria"
          }
    ],
  },
  "AD": {
    code: "AD",
    name: "Andorra",
    flag: "🇦🇩",
    dialCode: "+376",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ad-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Andorra"
          }
    ],
  },
  "AO": {
    code: "AO",
    name: "Angola",
    flag: "🇦🇴",
    dialCode: "+244",
    primaryEmergency: "113",
    primaryLabel: 'DIAL ' + "113",
    services: [
          {
                "id": "ao-emergency",
                "name": "Emergency Services (113)",
                "number": "113",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Angola"
          }
    ],
  },
  "AG": {
    code: "AG",
    name: "Antigua and Barbuda",
    flag: "🇦🇬",
    dialCode: "+1268",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ag-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Antigua and Barbuda"
          }
    ],
  },
  "AR": {
    code: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    dialCode: "+54",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ar-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Argentina"
          }
    ],
  },
  "AM": {
    code: "AM",
    name: "Armenia",
    flag: "🇦🇲",
    dialCode: "+374",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "am-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Armenia"
          }
    ],
  },
  "AW": {
    code: "AW",
    name: "Aruba",
    flag: "🇦🇼",
    dialCode: "+297",
    primaryEmergency: "100",
    primaryLabel: 'DIAL ' + "100",
    services: [
          {
                "id": "aw-emergency",
                "name": "Emergency Services (100)",
                "number": "100",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Aruba"
          }
    ],
  },
  "AU": {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    dialCode: "+61",
    primaryEmergency: "000",
    primaryLabel: 'DIAL ' + "000",
    services: [
          {
                "id": "au-000",
                "name": "Triple Zero (000)",
                "number": "000",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary Police, Fire, and Ambulance dispatch"
          },
          {
                "id": "au-ses",
                "name": "State Emergency Service",
                "number": "132500",
                "category": "special",
                "icon": "thunderstorm",
                "description": "Storm and flood disaster assistance"
          }
    ],
  },
  "AT": {
    code: "AT",
    name: "Austria",
    flag: "🇦🇹",
    dialCode: "+43",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "at-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Austria"
          }
    ],
  },
  "AZ": {
    code: "AZ",
    name: "Azerbaijan",
    flag: "🇦🇿",
    dialCode: "+994",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "az-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Azerbaijan"
          }
    ],
  },
  "BS": {
    code: "BS",
    name: "Bahamas",
    flag: "🇧🇸",
    dialCode: "+1242",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "bs-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bahamas"
          }
    ],
  },
  "BH": {
    code: "BH",
    name: "Bahrain",
    flag: "🇧🇭",
    dialCode: "+973",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "bh-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bahrain"
          }
    ],
  },
  "BD": {
    code: "BD",
    name: "Bangladesh",
    flag: "🇧🇩",
    dialCode: "+880",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "bd-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bangladesh"
          }
    ],
  },
  "BB": {
    code: "BB",
    name: "Barbados",
    flag: "🇧🇧",
    dialCode: "+1246",
    primaryEmergency: "211",
    primaryLabel: 'DIAL ' + "211",
    services: [
          {
                "id": "bb-emergency",
                "name": "Emergency Services (211)",
                "number": "211",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Barbados"
          }
    ],
  },
  "BY": {
    code: "BY",
    name: "Belarus",
    flag: "🇧🇾",
    dialCode: "+375",
    primaryEmergency: "102",
    primaryLabel: 'DIAL ' + "102",
    services: [
          {
                "id": "by-emergency",
                "name": "Emergency Services (102)",
                "number": "102",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Belarus"
          }
    ],
  },
  "BE": {
    code: "BE",
    name: "Belgium",
    flag: "🇧🇪",
    dialCode: "+32",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "be-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Belgium"
          }
    ],
  },
  "BZ": {
    code: "BZ",
    name: "Belize",
    flag: "🇧🇿",
    dialCode: "+501",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "bz-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Belize"
          }
    ],
  },
  "BJ": {
    code: "BJ",
    name: "Benin",
    flag: "🇧🇯",
    dialCode: "+229",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "bj-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Benin"
          }
    ],
  },
  "BM": {
    code: "BM",
    name: "Bermuda",
    flag: "🇧🇲",
    dialCode: "+1441",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "bm-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bermuda"
          }
    ],
  },
  "BT": {
    code: "BT",
    name: "Bhutan",
    flag: "🇧🇹",
    dialCode: "+975",
    primaryEmergency: "113",
    primaryLabel: 'DIAL ' + "113",
    services: [
          {
                "id": "bt-emergency",
                "name": "Emergency Services (113)",
                "number": "113",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bhutan"
          }
    ],
  },
  "BO": {
    code: "BO",
    name: "Bolivia",
    flag: "🇧🇴",
    dialCode: "+591",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "bo-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bolivia"
          }
    ],
  },
  "BA": {
    code: "BA",
    name: "Bosnia and Herzegovina",
    flag: "🇧🇦",
    dialCode: "+387",
    primaryEmergency: "122",
    primaryLabel: 'DIAL ' + "122",
    services: [
          {
                "id": "ba-emergency",
                "name": "Emergency Services (122)",
                "number": "122",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bosnia and Herzegovina"
          }
    ],
  },
  "BW": {
    code: "BW",
    name: "Botswana",
    flag: "🇧🇼",
    dialCode: "+267",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "bw-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Botswana"
          }
    ],
  },
  "BR": {
    code: "BR",
    name: "Brazil",
    flag: "🇧🇷",
    dialCode: "+55",
    primaryEmergency: "190",
    primaryLabel: 'DIAL ' + "190",
    services: [
          {
                "id": "br-emergency",
                "name": "Emergency Services (190)",
                "number": "190",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Brazil"
          }
    ],
  },
  "BN": {
    code: "BN",
    name: "Brunei",
    flag: "🇧🇳",
    dialCode: "+673",
    primaryEmergency: "993",
    primaryLabel: 'DIAL ' + "993",
    services: [
          {
                "id": "bn-emergency",
                "name": "Emergency Services (993)",
                "number": "993",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Brunei"
          }
    ],
  },
  "BG": {
    code: "BG",
    name: "Bulgaria",
    flag: "🇧🇬",
    dialCode: "+359",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "bg-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Bulgaria"
          }
    ],
  },
  "BF": {
    code: "BF",
    name: "Burkina Faso",
    flag: "🇧🇫",
    dialCode: "+226",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "bf-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Burkina Faso"
          }
    ],
  },
  "BI": {
    code: "BI",
    name: "Burundi",
    flag: "🇧🇮",
    dialCode: "+257",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "bi-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Burundi"
          }
    ],
  },
  "KH": {
    code: "KH",
    name: "Cambodia",
    flag: "🇰🇭",
    dialCode: "+855",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "kh-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cambodia"
          }
    ],
  },
  "CM": {
    code: "CM",
    name: "Cameroon",
    flag: "🇨🇲",
    dialCode: "+237",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "cm-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cameroon"
          }
    ],
  },
  "CA": {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    dialCode: "+1",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ca-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Canada"
          }
    ],
  },
  "CV": {
    code: "CV",
    name: "Cabo Verde",
    flag: "🇨🇻",
    dialCode: "+238",
    primaryEmergency: "132",
    primaryLabel: 'DIAL ' + "132",
    services: [
          {
                "id": "cv-emergency",
                "name": "Emergency Services (132)",
                "number": "132",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cabo Verde"
          }
    ],
  },
  "KY": {
    code: "KY",
    name: "Cayman Islands",
    flag: "🇰🇾",
    dialCode: "+1345",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ky-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cayman Islands"
          }
    ],
  },
  "CF": {
    code: "CF",
    name: "Central African Republic",
    flag: "🇨🇫",
    dialCode: "+236",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "cf-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Central African Republic"
          }
    ],
  },
  "TD": {
    code: "TD",
    name: "Chad",
    flag: "🇹🇩",
    dialCode: "+235",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "td-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Chad"
          }
    ],
  },
  "CL": {
    code: "CL",
    name: "Chile",
    flag: "🇨🇱",
    dialCode: "+56",
    primaryEmergency: "133",
    primaryLabel: 'DIAL ' + "133",
    services: [
          {
                "id": "cl-emergency",
                "name": "Emergency Services (133)",
                "number": "133",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Chile"
          }
    ],
  },
  "CN": {
    code: "CN",
    name: "China",
    flag: "🇨🇳",
    dialCode: "+86",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "cn-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for China"
          }
    ],
  },
  "CO": {
    code: "CO",
    name: "Colombia",
    flag: "🇨🇴",
    dialCode: "+57",
    primaryEmergency: "123",
    primaryLabel: 'DIAL ' + "123",
    services: [
          {
                "id": "co-emergency",
                "name": "Emergency Services (123)",
                "number": "123",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Colombia"
          }
    ],
  },
  "KM": {
    code: "KM",
    name: "Comoros",
    flag: "🇰🇲",
    dialCode: "+269",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "km-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Comoros"
          }
    ],
  },
  "CG": {
    code: "CG",
    name: "Congo",
    flag: "🇨🇬",
    dialCode: "+242",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "cg-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Congo"
          }
    ],
  },
  "CD": {
    code: "CD",
    name: "DR Congo",
    flag: "🇨🇩",
    dialCode: "+243",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "cd-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for DR Congo"
          }
    ],
  },
  "CR": {
    code: "CR",
    name: "Costa Rica",
    flag: "🇨🇷",
    dialCode: "+506",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "cr-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Costa Rica"
          }
    ],
  },
  "CI": {
    code: "CI",
    name: "Cote d'Ivoire",
    flag: "🇨🇮",
    dialCode: "+225",
    primaryEmergency: "111",
    primaryLabel: 'DIAL ' + "111",
    services: [
          {
                "id": "ci-emergency",
                "name": "Emergency Services (111)",
                "number": "111",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cote d'Ivoire"
          }
    ],
  },
  "HR": {
    code: "HR",
    name: "Croatia",
    flag: "🇭🇷",
    dialCode: "+385",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "hr-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Croatia"
          }
    ],
  },
  "CU": {
    code: "CU",
    name: "Cuba",
    flag: "🇨🇺",
    dialCode: "+53",
    primaryEmergency: "106",
    primaryLabel: 'DIAL ' + "106",
    services: [
          {
                "id": "cu-emergency",
                "name": "Emergency Services (106)",
                "number": "106",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cuba"
          }
    ],
  },
  "CW": {
    code: "CW",
    name: "Curacao",
    flag: "🇨🇼",
    dialCode: "+599",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "cw-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Curacao"
          }
    ],
  },
  "CY": {
    code: "CY",
    name: "Cyprus",
    flag: "🇨🇾",
    dialCode: "+357",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "cy-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Cyprus"
          }
    ],
  },
  "CZ": {
    code: "CZ",
    name: "Czech Republic",
    flag: "🇨🇿",
    dialCode: "+420",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "cz-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Czech Republic"
          }
    ],
  },
  "DK": {
    code: "DK",
    name: "Denmark",
    flag: "🇩🇰",
    dialCode: "+45",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "dk-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Denmark"
          }
    ],
  },
  "DJ": {
    code: "DJ",
    name: "Djibouti",
    flag: "🇩🇯",
    dialCode: "+253",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "dj-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Djibouti"
          }
    ],
  },
  "DM": {
    code: "DM",
    name: "Dominica",
    flag: "🇩🇲",
    dialCode: "+1767",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "dm-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Dominica"
          }
    ],
  },
  "DO": {
    code: "DO",
    name: "Dominican Republic",
    flag: "🇩🇴",
    dialCode: "+1809",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "do-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Dominican Republic"
          }
    ],
  },
  "EC": {
    code: "EC",
    name: "Ecuador",
    flag: "🇪🇨",
    dialCode: "+593",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ec-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Ecuador"
          }
    ],
  },
  "EG": {
    code: "EG",
    name: "Egypt",
    flag: "🇪🇬",
    dialCode: "+20",
    primaryEmergency: "122",
    primaryLabel: 'DIAL ' + "122",
    services: [
          {
                "id": "eg-emergency",
                "name": "Emergency Services (122)",
                "number": "122",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Egypt"
          }
    ],
  },
  "SV": {
    code: "SV",
    name: "El Salvador",
    flag: "🇸🇻",
    dialCode: "+503",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "sv-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for El Salvador"
          }
    ],
  },
  "GQ": {
    code: "GQ",
    name: "Equatorial Guinea",
    flag: "🇬🇶",
    dialCode: "+240",
    primaryEmergency: "114",
    primaryLabel: 'DIAL ' + "114",
    services: [
          {
                "id": "gq-emergency",
                "name": "Emergency Services (114)",
                "number": "114",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Equatorial Guinea"
          }
    ],
  },
  "ER": {
    code: "ER",
    name: "Eritrea",
    flag: "🇪🇷",
    dialCode: "+291",
    primaryEmergency: "113",
    primaryLabel: 'DIAL ' + "113",
    services: [
          {
                "id": "er-emergency",
                "name": "Emergency Services (113)",
                "number": "113",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Eritrea"
          }
    ],
  },
  "EE": {
    code: "EE",
    name: "Estonia",
    flag: "🇪🇪",
    dialCode: "+372",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ee-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Estonia"
          }
    ],
  },
  "SZ": {
    code: "SZ",
    name: "Eswatini",
    flag: "🇸🇿",
    dialCode: "+268",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sz-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Eswatini"
          }
    ],
  },
  "ET": {
    code: "ET",
    name: "Ethiopia",
    flag: "🇪🇹",
    dialCode: "+251",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "et-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Ethiopia"
          }
    ],
  },
  "FJ": {
    code: "FJ",
    name: "Fiji",
    flag: "🇫🇯",
    dialCode: "+679",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "fj-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Fiji"
          }
    ],
  },
  "FI": {
    code: "FI",
    name: "Finland",
    flag: "🇫🇮",
    dialCode: "+358",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "fi-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Finland"
          }
    ],
  },
  "FR": {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    dialCode: "+33",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "fr-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for France"
          }
    ],
  },
  "GF": {
    code: "GF",
    name: "French Guiana",
    flag: "🇬🇫",
    dialCode: "+594",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "gf-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for French Guiana"
          }
    ],
  },
  "PF": {
    code: "PF",
    name: "French Polynesia",
    flag: "🇵🇫",
    dialCode: "+689",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "pf-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for French Polynesia"
          }
    ],
  },
  "GA": {
    code: "GA",
    name: "Gabon",
    flag: "🇬🇦",
    dialCode: "+241",
    primaryEmergency: "177",
    primaryLabel: 'DIAL ' + "177",
    services: [
          {
                "id": "ga-emergency",
                "name": "Emergency Services (177)",
                "number": "177",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Gabon"
          }
    ],
  },
  "GM": {
    code: "GM",
    name: "Gambia",
    flag: "🇬🇲",
    dialCode: "+220",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "gm-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Gambia"
          }
    ],
  },
  "GE": {
    code: "GE",
    name: "Georgia",
    flag: "🇬🇪",
    dialCode: "+995",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ge-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Georgia"
          }
    ],
  },
  "DE": {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    dialCode: "+49",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "de-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Germany"
          }
    ],
  },
  "GH": {
    code: "GH",
    name: "Ghana",
    flag: "🇬🇭",
    dialCode: "+233",
    primaryEmergency: "191",
    primaryLabel: 'DIAL ' + "191",
    services: [
          {
                "id": "gh-emergency",
                "name": "Emergency Services (191)",
                "number": "191",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Ghana"
          }
    ],
  },
  "GI": {
    code: "GI",
    name: "Gibraltar",
    flag: "🇬🇮",
    dialCode: "+350",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "gi-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Gibraltar"
          }
    ],
  },
  "GR": {
    code: "GR",
    name: "Greece",
    flag: "🇬🇷",
    dialCode: "+30",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "gr-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Greece"
          }
    ],
  },
  "GL": {
    code: "GL",
    name: "Greenland",
    flag: "🇬🇱",
    dialCode: "+299",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "gl-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Greenland"
          }
    ],
  },
  "GD": {
    code: "GD",
    name: "Grenada",
    flag: "🇬🇩",
    dialCode: "+1473",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "gd-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Grenada"
          }
    ],
  },
  "GP": {
    code: "GP",
    name: "Guadeloupe",
    flag: "🇬🇵",
    dialCode: "+590",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "gp-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Guadeloupe"
          }
    ],
  },
  "GU": {
    code: "GU",
    name: "Guam",
    flag: "🇬🇺",
    dialCode: "+1671",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "gu-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Guam"
          }
    ],
  },
  "GT": {
    code: "GT",
    name: "Guatemala",
    flag: "🇬🇹",
    dialCode: "+502",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "gt-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Guatemala"
          }
    ],
  },
  "GN": {
    code: "GN",
    name: "Guinea",
    flag: "🇬🇳",
    dialCode: "+224",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "gn-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Guinea"
          }
    ],
  },
  "GW": {
    code: "GW",
    name: "Guinea-Bissau",
    flag: "🇬🇼",
    dialCode: "+245",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "gw-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Guinea-Bissau"
          }
    ],
  },
  "GY": {
    code: "GY",
    name: "Guyana",
    flag: "🇬🇾",
    dialCode: "+592",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "gy-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Guyana"
          }
    ],
  },
  "HT": {
    code: "HT",
    name: "Haiti",
    flag: "🇭🇹",
    dialCode: "+509",
    primaryEmergency: "114",
    primaryLabel: 'DIAL ' + "114",
    services: [
          {
                "id": "ht-emergency",
                "name": "Emergency Services (114)",
                "number": "114",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Haiti"
          }
    ],
  },
  "HN": {
    code: "HN",
    name: "Honduras",
    flag: "🇭🇳",
    dialCode: "+504",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "hn-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Honduras"
          }
    ],
  },
  "HK": {
    code: "HK",
    name: "Hong Kong",
    flag: "🇭🇰",
    dialCode: "+852",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "hk-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Hong Kong"
          }
    ],
  },
  "HU": {
    code: "HU",
    name: "Hungary",
    flag: "🇭🇺",
    dialCode: "+36",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "hu-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Hungary"
          }
    ],
  },
  "IS": {
    code: "IS",
    name: "Iceland",
    flag: "🇮🇸",
    dialCode: "+354",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "is-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Iceland"
          }
    ],
  },
  "IN": {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    dialCode: "+91",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "in-police",
                "name": "Police Emergency",
                "number": "100",
                "category": "police",
                "icon": "shield-checkmark",
                "description": "Instant Police Dispatch & Patrol Response"
          },
          {
                "id": "in-ambulance",
                "name": "Ambulance & Medical",
                "number": "108",
                "category": "medical",
                "icon": "medical",
                "description": "Emergency Medical & Trauma Services (108 / 102)"
          },
          {
                "id": "in-fire",
                "name": "Fire & Rescue",
                "number": "101",
                "category": "fire",
                "icon": "flame",
                "description": "Fire Brigade & Disaster Relief Operations"
          },
          {
                "id": "in-erss",
                "name": "National ERSS (All-in-One)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Unified Emergency Response Support System"
          },
          {
                "id": "in-women",
                "name": "Women Helpline",
                "number": "1091",
                "category": "women",
                "icon": "heart",
                "description": "Dedicated 24x7 Safety & Distress Support"
          },
          {
                "id": "in-child",
                "name": "Childline Emergency",
                "number": "1098",
                "category": "child",
                "icon": "people",
                "description": "National Child Protection Emergency"
          }
    ],
  },
  "ID": {
    code: "ID",
    name: "Indonesia",
    flag: "🇮🇩",
    dialCode: "+62",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "id-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Indonesia"
          }
    ],
  },
  "IR": {
    code: "IR",
    name: "Iran",
    flag: "🇮🇷",
    dialCode: "+98",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "ir-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Iran"
          }
    ],
  },
  "IQ": {
    code: "IQ",
    name: "Iraq",
    flag: "🇮🇶",
    dialCode: "+964",
    primaryEmergency: "104",
    primaryLabel: 'DIAL ' + "104",
    services: [
          {
                "id": "iq-emergency",
                "name": "Emergency Services (104)",
                "number": "104",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Iraq"
          }
    ],
  },
  "IE": {
    code: "IE",
    name: "Ireland",
    flag: "🇮🇪",
    dialCode: "+353",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ie-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Ireland"
          }
    ],
  },
  "IL": {
    code: "IL",
    name: "Israel",
    flag: "🇮🇱",
    dialCode: "+972",
    primaryEmergency: "100",
    primaryLabel: 'DIAL ' + "100",
    services: [
          {
                "id": "il-emergency",
                "name": "Emergency Services (100)",
                "number": "100",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Israel"
          }
    ],
  },
  "IT": {
    code: "IT",
    name: "Italy",
    flag: "🇮🇹",
    dialCode: "+39",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "it-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Italy"
          }
    ],
  },
  "JM": {
    code: "JM",
    name: "Jamaica",
    flag: "🇯🇲",
    dialCode: "+1876",
    primaryEmergency: "119",
    primaryLabel: 'DIAL ' + "119",
    services: [
          {
                "id": "jm-emergency",
                "name": "Emergency Services (119)",
                "number": "119",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Jamaica"
          }
    ],
  },
  "JP": {
    code: "JP",
    name: "Japan",
    flag: "🇯🇵",
    dialCode: "+81",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "jp-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Japan"
          }
    ],
  },
  "JO": {
    code: "JO",
    name: "Jordan",
    flag: "🇯🇴",
    dialCode: "+962",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "jo-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Jordan"
          }
    ],
  },
  "KZ": {
    code: "KZ",
    name: "Kazakhstan",
    flag: "🇰🇿",
    dialCode: "+7",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "kz-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Kazakhstan"
          }
    ],
  },
  "KE": {
    code: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    dialCode: "+254",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "ke-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Kenya"
          }
    ],
  },
  "KI": {
    code: "KI",
    name: "Kiribati",
    flag: "🇰🇮",
    dialCode: "+686",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "ki-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Kiribati"
          }
    ],
  },
  "KR": {
    code: "KR",
    name: "South Korea",
    flag: "🇰🇷",
    dialCode: "+82",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "kr-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for South Korea"
          }
    ],
  },
  "KW": {
    code: "KW",
    name: "Kuwait",
    flag: "🇰🇼",
    dialCode: "+965",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "kw-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Kuwait"
          }
    ],
  },
  "KG": {
    code: "KG",
    name: "Kyrgyzstan",
    flag: "🇰🇬",
    dialCode: "+996",
    primaryEmergency: "102",
    primaryLabel: 'DIAL ' + "102",
    services: [
          {
                "id": "kg-emergency",
                "name": "Emergency Services (102)",
                "number": "102",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Kyrgyzstan"
          }
    ],
  },
  "LA": {
    code: "LA",
    name: "Laos",
    flag: "🇱🇦",
    dialCode: "+856",
    primaryEmergency: "191",
    primaryLabel: 'DIAL ' + "191",
    services: [
          {
                "id": "la-emergency",
                "name": "Emergency Services (191)",
                "number": "191",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Laos"
          }
    ],
  },
  "LV": {
    code: "LV",
    name: "Latvia",
    flag: "🇱🇻",
    dialCode: "+371",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "lv-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Latvia"
          }
    ],
  },
  "LB": {
    code: "LB",
    name: "Lebanon",
    flag: "🇱🇧",
    dialCode: "+961",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "lb-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Lebanon"
          }
    ],
  },
  "LS": {
    code: "LS",
    name: "Lesotho",
    flag: "🇱🇸",
    dialCode: "+266",
    primaryEmergency: "123",
    primaryLabel: 'DIAL ' + "123",
    services: [
          {
                "id": "ls-emergency",
                "name": "Emergency Services (123)",
                "number": "123",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Lesotho"
          }
    ],
  },
  "LR": {
    code: "LR",
    name: "Liberia",
    flag: "🇱🇷",
    dialCode: "+231",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "lr-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Liberia"
          }
    ],
  },
  "LY": {
    code: "LY",
    name: "Libya",
    flag: "🇱🇾",
    dialCode: "+218",
    primaryEmergency: "1515",
    primaryLabel: 'DIAL ' + "1515",
    services: [
          {
                "id": "ly-emergency",
                "name": "Emergency Services (1515)",
                "number": "1515",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Libya"
          }
    ],
  },
  "LI": {
    code: "LI",
    name: "Liechtenstein",
    flag: "🇱🇮",
    dialCode: "+423",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "li-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Liechtenstein"
          }
    ],
  },
  "LT": {
    code: "LT",
    name: "Lithuania",
    flag: "🇱🇹",
    dialCode: "+370",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "lt-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Lithuania"
          }
    ],
  },
  "LU": {
    code: "LU",
    name: "Luxembourg",
    flag: "🇱🇺",
    dialCode: "+352",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "lu-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Luxembourg"
          }
    ],
  },
  "MO": {
    code: "MO",
    name: "Macau",
    flag: "🇲🇴",
    dialCode: "+853",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "mo-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Macau"
          }
    ],
  },
  "MK": {
    code: "MK",
    name: "North Macedonia",
    flag: "🇲🇰",
    dialCode: "+389",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "mk-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for North Macedonia"
          }
    ],
  },
  "MG": {
    code: "MG",
    name: "Madagascar",
    flag: "🇲🇬",
    dialCode: "+261",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "mg-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Madagascar"
          }
    ],
  },
  "MW": {
    code: "MW",
    name: "Malawi",
    flag: "🇲🇼",
    dialCode: "+265",
    primaryEmergency: "997",
    primaryLabel: 'DIAL ' + "997",
    services: [
          {
                "id": "mw-emergency",
                "name": "Emergency Services (997)",
                "number": "997",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Malawi"
          }
    ],
  },
  "MY": {
    code: "MY",
    name: "Malaysia",
    flag: "🇲🇾",
    dialCode: "+60",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "my-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Malaysia"
          }
    ],
  },
  "MV": {
    code: "MV",
    name: "Maldives",
    flag: "🇲🇻",
    dialCode: "+960",
    primaryEmergency: "119",
    primaryLabel: 'DIAL ' + "119",
    services: [
          {
                "id": "mv-emergency",
                "name": "Emergency Services (119)",
                "number": "119",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Maldives"
          }
    ],
  },
  "ML": {
    code: "ML",
    name: "Mali",
    flag: "🇲🇱",
    dialCode: "+223",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "ml-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Mali"
          }
    ],
  },
  "MT": {
    code: "MT",
    name: "Malta",
    flag: "🇲🇹",
    dialCode: "+356",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "mt-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Malta"
          }
    ],
  },
  "MH": {
    code: "MH",
    name: "Marshall Islands",
    flag: "🇲🇭",
    dialCode: "+692",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "mh-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Marshall Islands"
          }
    ],
  },
  "MQ": {
    code: "MQ",
    name: "Martinique",
    flag: "🇲🇶",
    dialCode: "+596",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "mq-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Martinique"
          }
    ],
  },
  "MR": {
    code: "MR",
    name: "Mauritania",
    flag: "🇲🇷",
    dialCode: "+222",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "mr-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Mauritania"
          }
    ],
  },
  "MU": {
    code: "MU",
    name: "Mauritius",
    flag: "🇲🇺",
    dialCode: "+230",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "mu-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Mauritius"
          }
    ],
  },
  "MX": {
    code: "MX",
    name: "Mexico",
    flag: "🇲🇽",
    dialCode: "+52",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "mx-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Mexico"
          }
    ],
  },
  "FM": {
    code: "FM",
    name: "Micronesia",
    flag: "🇫🇲",
    dialCode: "+691",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "fm-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Micronesia"
          }
    ],
  },
  "MD": {
    code: "MD",
    name: "Moldova",
    flag: "🇲🇩",
    dialCode: "+373",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "md-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Moldova"
          }
    ],
  },
  "MC": {
    code: "MC",
    name: "Monaco",
    flag: "🇲🇨",
    dialCode: "+377",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "mc-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Monaco"
          }
    ],
  },
  "MN": {
    code: "MN",
    name: "Mongolia",
    flag: "🇲🇳",
    dialCode: "+976",
    primaryEmergency: "102",
    primaryLabel: 'DIAL ' + "102",
    services: [
          {
                "id": "mn-emergency",
                "name": "Emergency Services (102)",
                "number": "102",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Mongolia"
          }
    ],
  },
  "ME": {
    code: "ME",
    name: "Montenegro",
    flag: "🇲🇪",
    dialCode: "+382",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "me-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Montenegro"
          }
    ],
  },
  "MS": {
    code: "MS",
    name: "Montserrat",
    flag: "🇲🇸",
    dialCode: "+1664",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ms-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Montserrat"
          }
    ],
  },
  "MA": {
    code: "MA",
    name: "Morocco",
    flag: "🇲🇦",
    dialCode: "+212",
    primaryEmergency: "19",
    primaryLabel: 'DIAL ' + "19",
    services: [
          {
                "id": "ma-emergency",
                "name": "Emergency Services (19)",
                "number": "19",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Morocco"
          }
    ],
  },
  "MZ": {
    code: "MZ",
    name: "Mozambique",
    flag: "🇲🇿",
    dialCode: "+258",
    primaryEmergency: "119",
    primaryLabel: 'DIAL ' + "119",
    services: [
          {
                "id": "mz-emergency",
                "name": "Emergency Services (119)",
                "number": "119",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Mozambique"
          }
    ],
  },
  "MM": {
    code: "MM",
    name: "Myanmar",
    flag: "🇲🇲",
    dialCode: "+95",
    primaryEmergency: "199",
    primaryLabel: 'DIAL ' + "199",
    services: [
          {
                "id": "mm-emergency",
                "name": "Emergency Services (199)",
                "number": "199",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Myanmar"
          }
    ],
  },
  "NA": {
    code: "NA",
    name: "Namibia",
    flag: "🇳🇦",
    dialCode: "+264",
    primaryEmergency: "10111",
    primaryLabel: 'DIAL ' + "10111",
    services: [
          {
                "id": "na-emergency",
                "name": "Emergency Services (10111)",
                "number": "10111",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Namibia"
          }
    ],
  },
  "NR": {
    code: "NR",
    name: "Nauru",
    flag: "🇳🇷",
    dialCode: "+674",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "nr-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Nauru"
          }
    ],
  },
  "NP": {
    code: "NP",
    name: "Nepal",
    flag: "🇳🇵",
    dialCode: "+977",
    primaryEmergency: "100",
    primaryLabel: 'DIAL ' + "100",
    services: [
          {
                "id": "np-emergency",
                "name": "Emergency Services (100)",
                "number": "100",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Nepal"
          }
    ],
  },
  "NL": {
    code: "NL",
    name: "Netherlands",
    flag: "🇳🇱",
    dialCode: "+31",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "nl-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Netherlands"
          }
    ],
  },
  "NC": {
    code: "NC",
    name: "New Caledonia",
    flag: "🇳🇨",
    dialCode: "+687",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "nc-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for New Caledonia"
          }
    ],
  },
  "NZ": {
    code: "NZ",
    name: "New Zealand",
    flag: "🇳🇿",
    dialCode: "+64",
    primaryEmergency: "111",
    primaryLabel: 'DIAL ' + "111",
    services: [
          {
                "id": "nz-emergency",
                "name": "Emergency Services (111)",
                "number": "111",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for New Zealand"
          }
    ],
  },
  "NI": {
    code: "NI",
    name: "Nicaragua",
    flag: "🇳🇮",
    dialCode: "+505",
    primaryEmergency: "118",
    primaryLabel: 'DIAL ' + "118",
    services: [
          {
                "id": "ni-emergency",
                "name": "Emergency Services (118)",
                "number": "118",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Nicaragua"
          }
    ],
  },
  "NE": {
    code: "NE",
    name: "Niger",
    flag: "🇳🇪",
    dialCode: "+227",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "ne-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Niger"
          }
    ],
  },
  "NG": {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    dialCode: "+234",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ng-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Nigeria"
          }
    ],
  },
  "NO": {
    code: "NO",
    name: "Norway",
    flag: "🇳🇴",
    dialCode: "+47",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "no-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Norway"
          }
    ],
  },
  "OM": {
    code: "OM",
    name: "Oman",
    flag: "🇴🇲",
    dialCode: "+968",
    primaryEmergency: "9999",
    primaryLabel: 'DIAL ' + "9999",
    services: [
          {
                "id": "om-emergency",
                "name": "Emergency Services (9999)",
                "number": "9999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Oman"
          }
    ],
  },
  "PK": {
    code: "PK",
    name: "Pakistan",
    flag: "🇵🇰",
    dialCode: "+92",
    primaryEmergency: "15",
    primaryLabel: 'DIAL ' + "15",
    services: [
          {
                "id": "pk-emergency",
                "name": "Emergency Services (15)",
                "number": "15",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Pakistan"
          }
    ],
  },
  "PW": {
    code: "PW",
    name: "Palau",
    flag: "🇵🇼",
    dialCode: "+680",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "pw-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Palau"
          }
    ],
  },
  "PS": {
    code: "PS",
    name: "Palestine",
    flag: "🇵🇸",
    dialCode: "+970",
    primaryEmergency: "100",
    primaryLabel: 'DIAL ' + "100",
    services: [
          {
                "id": "ps-emergency",
                "name": "Emergency Services (100)",
                "number": "100",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Palestine"
          }
    ],
  },
  "PA": {
    code: "PA",
    name: "Panama",
    flag: "🇵🇦",
    dialCode: "+507",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "pa-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Panama"
          }
    ],
  },
  "PG": {
    code: "PG",
    name: "Papua New Guinea",
    flag: "🇵🇬",
    dialCode: "+675",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "pg-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Papua New Guinea"
          }
    ],
  },
  "PY": {
    code: "PY",
    name: "Paraguay",
    flag: "🇵🇾",
    dialCode: "+595",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "py-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Paraguay"
          }
    ],
  },
  "PE": {
    code: "PE",
    name: "Peru",
    flag: "🇵🇪",
    dialCode: "+51",
    primaryEmergency: "105",
    primaryLabel: 'DIAL ' + "105",
    services: [
          {
                "id": "pe-emergency",
                "name": "Emergency Services (105)",
                "number": "105",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Peru"
          }
    ],
  },
  "PH": {
    code: "PH",
    name: "Philippines",
    flag: "🇵🇭",
    dialCode: "+63",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ph-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Philippines"
          }
    ],
  },
  "PL": {
    code: "PL",
    name: "Poland",
    flag: "🇵🇱",
    dialCode: "+48",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "pl-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Poland"
          }
    ],
  },
  "PT": {
    code: "PT",
    name: "Portugal",
    flag: "🇵🇹",
    dialCode: "+351",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "pt-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Portugal"
          }
    ],
  },
  "PR": {
    code: "PR",
    name: "Puerto Rico",
    flag: "🇵🇷",
    dialCode: "+1787",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "pr-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Puerto Rico"
          }
    ],
  },
  "QA": {
    code: "QA",
    name: "Qatar",
    flag: "🇶🇦",
    dialCode: "+974",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "qa-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Qatar"
          }
    ],
  },
  "RE": {
    code: "RE",
    name: "Reunion",
    flag: "🇷🇪",
    dialCode: "+262",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "re-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Reunion"
          }
    ],
  },
  "RO": {
    code: "RO",
    name: "Romania",
    flag: "🇷🇴",
    dialCode: "+40",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ro-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Romania"
          }
    ],
  },
  "RU": {
    code: "RU",
    name: "Russia",
    flag: "🇷🇺",
    dialCode: "+7",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ru-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Russia"
          }
    ],
  },
  "RW": {
    code: "RW",
    name: "Rwanda",
    flag: "🇷🇼",
    dialCode: "+250",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "rw-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Rwanda"
          }
    ],
  },
  "KN": {
    code: "KN",
    name: "Saint Kitts and Nevis",
    flag: "🇰🇳",
    dialCode: "+1869",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "kn-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Saint Kitts and Nevis"
          }
    ],
  },
  "LC": {
    code: "LC",
    name: "Saint Lucia",
    flag: "🇱🇨",
    dialCode: "+1758",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "lc-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Saint Lucia"
          }
    ],
  },
  "VC": {
    code: "VC",
    name: "Saint Vincent and the Grenadines",
    flag: "🇻🇨",
    dialCode: "+1784",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "vc-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Saint Vincent and the Grenadines"
          }
    ],
  },
  "WS": {
    code: "WS",
    name: "Samoa",
    flag: "🇼🇸",
    dialCode: "+685",
    primaryEmergency: "995",
    primaryLabel: 'DIAL ' + "995",
    services: [
          {
                "id": "ws-emergency",
                "name": "Emergency Services (995)",
                "number": "995",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Samoa"
          }
    ],
  },
  "SM": {
    code: "SM",
    name: "San Marino",
    flag: "🇸🇲",
    dialCode: "+378",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "sm-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for San Marino"
          }
    ],
  },
  "ST": {
    code: "ST",
    name: "Sao Tome and Principe",
    flag: "🇸🇹",
    dialCode: "+239",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "st-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Sao Tome and Principe"
          }
    ],
  },
  "SA": {
    code: "SA",
    name: "Saudi Arabia",
    flag: "🇸🇦",
    dialCode: "+966",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sa-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Saudi Arabia"
          }
    ],
  },
  "SN": {
    code: "SN",
    name: "Senegal",
    flag: "🇸🇳",
    dialCode: "+221",
    primaryEmergency: "17",
    primaryLabel: 'DIAL ' + "17",
    services: [
          {
                "id": "sn-emergency",
                "name": "Emergency Services (17)",
                "number": "17",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Senegal"
          }
    ],
  },
  "RS": {
    code: "RS",
    name: "Serbia",
    flag: "🇷🇸",
    dialCode: "+381",
    primaryEmergency: "192",
    primaryLabel: 'DIAL ' + "192",
    services: [
          {
                "id": "rs-emergency",
                "name": "Emergency Services (192)",
                "number": "192",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Serbia"
          }
    ],
  },
  "SC": {
    code: "SC",
    name: "Seychelles",
    flag: "🇸🇨",
    dialCode: "+248",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sc-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Seychelles"
          }
    ],
  },
  "SL": {
    code: "SL",
    name: "Sierra Leone",
    flag: "🇸🇱",
    dialCode: "+232",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sl-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Sierra Leone"
          }
    ],
  },
  "SG": {
    code: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    dialCode: "+65",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sg-police",
                "name": "Singapore Police Force",
                "number": "999",
                "category": "police",
                "icon": "shield-checkmark",
                "description": "Emergency Police Dispatch"
          },
          {
                "id": "sg-scdf",
                "name": "Ambulance & Fire (SCDF)",
                "number": "995",
                "category": "medical",
                "icon": "flame",
                "description": "Civil Defence Emergency Ambulance & Fire"
          }
    ],
  },
  "SK": {
    code: "SK",
    name: "Slovakia",
    flag: "🇸🇰",
    dialCode: "+421",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "sk-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Slovakia"
          }
    ],
  },
  "SI": {
    code: "SI",
    name: "Slovenia",
    flag: "🇸🇮",
    dialCode: "+386",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "si-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Slovenia"
          }
    ],
  },
  "SB": {
    code: "SB",
    name: "Solomon Islands",
    flag: "🇸🇧",
    dialCode: "+677",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sb-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Solomon Islands"
          }
    ],
  },
  "SO": {
    code: "SO",
    name: "Somalia",
    flag: "🇸🇴",
    dialCode: "+252",
    primaryEmergency: "888",
    primaryLabel: 'DIAL ' + "888",
    services: [
          {
                "id": "so-emergency",
                "name": "Emergency Services (888)",
                "number": "888",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Somalia"
          }
    ],
  },
  "ZA": {
    code: "ZA",
    name: "South Africa",
    flag: "🇿🇦",
    dialCode: "+27",
    primaryEmergency: "10111",
    primaryLabel: 'DIAL ' + "10111",
    services: [
          {
                "id": "za-emergency",
                "name": "Emergency Services (10111)",
                "number": "10111",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for South Africa"
          }
    ],
  },
  "SS": {
    code: "SS",
    name: "South Sudan",
    flag: "🇸🇸",
    dialCode: "+211",
    primaryEmergency: "777",
    primaryLabel: 'DIAL ' + "777",
    services: [
          {
                "id": "ss-emergency",
                "name": "Emergency Services (777)",
                "number": "777",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for South Sudan"
          }
    ],
  },
  "ES": {
    code: "ES",
    name: "Spain",
    flag: "🇪🇸",
    dialCode: "+34",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "es-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Spain"
          }
    ],
  },
  "LK": {
    code: "LK",
    name: "Sri Lanka",
    flag: "🇱🇰",
    dialCode: "+94",
    primaryEmergency: "119",
    primaryLabel: 'DIAL ' + "119",
    services: [
          {
                "id": "lk-emergency",
                "name": "Emergency Services (119)",
                "number": "119",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Sri Lanka"
          }
    ],
  },
  "SD": {
    code: "SD",
    name: "Sudan",
    flag: "🇸🇩",
    dialCode: "+249",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "sd-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Sudan"
          }
    ],
  },
  "SR": {
    code: "SR",
    name: "Suriname",
    flag: "🇸🇷",
    dialCode: "+597",
    primaryEmergency: "115",
    primaryLabel: 'DIAL ' + "115",
    services: [
          {
                "id": "sr-emergency",
                "name": "Emergency Services (115)",
                "number": "115",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Suriname"
          }
    ],
  },
  "SE": {
    code: "SE",
    name: "Sweden",
    flag: "🇸🇪",
    dialCode: "+46",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "se-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Sweden"
          }
    ],
  },
  "CH": {
    code: "CH",
    name: "Switzerland",
    flag: "🇨🇭",
    dialCode: "+41",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ch-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Switzerland"
          }
    ],
  },
  "SY": {
    code: "SY",
    name: "Syria",
    flag: "🇸🇾",
    dialCode: "+963",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "sy-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Syria"
          }
    ],
  },
  "TW": {
    code: "TW",
    name: "Taiwan",
    flag: "🇹🇼",
    dialCode: "+886",
    primaryEmergency: "110",
    primaryLabel: 'DIAL ' + "110",
    services: [
          {
                "id": "tw-emergency",
                "name": "Emergency Services (110)",
                "number": "110",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Taiwan"
          }
    ],
  },
  "TJ": {
    code: "TJ",
    name: "Tajikistan",
    flag: "🇹🇯",
    dialCode: "+992",
    primaryEmergency: "102",
    primaryLabel: 'DIAL ' + "102",
    services: [
          {
                "id": "tj-emergency",
                "name": "Emergency Services (102)",
                "number": "102",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Tajikistan"
          }
    ],
  },
  "TZ": {
    code: "TZ",
    name: "Tanzania",
    flag: "🇹🇿",
    dialCode: "+255",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "tz-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Tanzania"
          }
    ],
  },
  "TH": {
    code: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    dialCode: "+66",
    primaryEmergency: "191",
    primaryLabel: 'DIAL ' + "191",
    services: [
          {
                "id": "th-emergency",
                "name": "Emergency Services (191)",
                "number": "191",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Thailand"
          }
    ],
  },
  "TL": {
    code: "TL",
    name: "Timor-Leste",
    flag: "🇹🇱",
    dialCode: "+670",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "tl-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Timor-Leste"
          }
    ],
  },
  "TG": {
    code: "TG",
    name: "Togo",
    flag: "🇹🇬",
    dialCode: "+228",
    primaryEmergency: "117",
    primaryLabel: 'DIAL ' + "117",
    services: [
          {
                "id": "tg-emergency",
                "name": "Emergency Services (117)",
                "number": "117",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Togo"
          }
    ],
  },
  "TO": {
    code: "TO",
    name: "Tonga",
    flag: "🇹🇴",
    dialCode: "+676",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "to-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Tonga"
          }
    ],
  },
  "TT": {
    code: "TT",
    name: "Trinidad and Tobago",
    flag: "🇹🇹",
    dialCode: "+1868",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "tt-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Trinidad and Tobago"
          }
    ],
  },
  "TN": {
    code: "TN",
    name: "Tunisia",
    flag: "🇹🇳",
    dialCode: "+216",
    primaryEmergency: "197",
    primaryLabel: 'DIAL ' + "197",
    services: [
          {
                "id": "tn-emergency",
                "name": "Emergency Services (197)",
                "number": "197",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Tunisia"
          }
    ],
  },
  "TR": {
    code: "TR",
    name: "Turkey",
    flag: "🇹🇷",
    dialCode: "+90",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "tr-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Turkey"
          }
    ],
  },
  "TM": {
    code: "TM",
    name: "Turkmenistan",
    flag: "🇹🇲",
    dialCode: "+993",
    primaryEmergency: "102",
    primaryLabel: 'DIAL ' + "102",
    services: [
          {
                "id": "tm-emergency",
                "name": "Emergency Services (102)",
                "number": "102",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Turkmenistan"
          }
    ],
  },
  "TC": {
    code: "TC",
    name: "Turks and Caicos Islands",
    flag: "🇹🇨",
    dialCode: "+1649",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "tc-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Turks and Caicos Islands"
          }
    ],
  },
  "TV": {
    code: "TV",
    name: "Tuvalu",
    flag: "🇹🇻",
    dialCode: "+688",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "tv-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Tuvalu"
          }
    ],
  },
  "UG": {
    code: "UG",
    name: "Uganda",
    flag: "🇺🇬",
    dialCode: "+256",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "ug-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Uganda"
          }
    ],
  },
  "UA": {
    code: "UA",
    name: "Ukraine",
    flag: "🇺🇦",
    dialCode: "+380",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "ua-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Ukraine"
          }
    ],
  },
  "AE": {
    code: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    dialCode: "+971",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "ae-police",
                "name": "Police Emergency",
                "number": "999",
                "category": "police",
                "icon": "shield-checkmark",
                "description": "Police Rescue & Dispatch"
          },
          {
                "id": "ae-ambulance",
                "name": "Ambulance Services",
                "number": "998",
                "category": "medical",
                "icon": "medical",
                "description": "National Ambulance Emergency Hotline"
          },
          {
                "id": "ae-fire",
                "name": "Civil Defence (Fire)",
                "number": "997",
                "category": "fire",
                "icon": "flame",
                "description": "Civil Defence and Fire Rescue"
          }
    ],
  },
  "GB": {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    dialCode: "+44",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "gb-999",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Police, Fire, and Ambulance Emergency Dispatch"
          },
          {
                "id": "gb-101",
                "name": "Police Non-Emergency",
                "number": "101",
                "category": "police",
                "icon": "shield-checkmark",
                "description": "Non-emergency crime reporting & support"
          },
          {
                "id": "gb-111",
                "name": "NHS Medical Advice",
                "number": "111",
                "category": "medical",
                "icon": "medical",
                "description": "Urgent medical assessment and clinical advice"
          }
    ],
  },
  "US": {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    dialCode: "+1",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "us-911",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Unified Police, Fire, and Paramedic Dispatch"
          },
          {
                "id": "us-poison",
                "name": "Poison Control Hotline",
                "number": "18002221222",
                "category": "medical",
                "icon": "medkit",
                "description": "National Poison Assistance & Triage"
          }
    ],
  },
  "UY": {
    code: "UY",
    name: "Uruguay",
    flag: "🇺🇾",
    dialCode: "+598",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "uy-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Uruguay"
          }
    ],
  },
  "UZ": {
    code: "UZ",
    name: "Uzbekistan",
    flag: "🇺🇿",
    dialCode: "+998",
    primaryEmergency: "102",
    primaryLabel: 'DIAL ' + "102",
    services: [
          {
                "id": "uz-emergency",
                "name": "Emergency Services (102)",
                "number": "102",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Uzbekistan"
          }
    ],
  },
  "VU": {
    code: "VU",
    name: "Vanuatu",
    flag: "🇻🇺",
    dialCode: "+678",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "vu-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Vanuatu"
          }
    ],
  },
  "VA": {
    code: "VA",
    name: "Vatican City",
    flag: "🇻🇦",
    dialCode: "+379",
    primaryEmergency: "112",
    primaryLabel: 'DIAL ' + "112",
    services: [
          {
                "id": "va-emergency",
                "name": "Emergency Services (112)",
                "number": "112",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Vatican City"
          }
    ],
  },
  "VE": {
    code: "VE",
    name: "Venezuela",
    flag: "🇻🇪",
    dialCode: "+58",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "ve-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Venezuela"
          }
    ],
  },
  "VN": {
    code: "VN",
    name: "Vietnam",
    flag: "🇻🇳",
    dialCode: "+84",
    primaryEmergency: "113",
    primaryLabel: 'DIAL ' + "113",
    services: [
          {
                "id": "vn-emergency",
                "name": "Emergency Services (113)",
                "number": "113",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Vietnam"
          }
    ],
  },
  "VG": {
    code: "VG",
    name: "British Virgin Islands",
    flag: "🇻🇬",
    dialCode: "+1284",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "vg-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for British Virgin Islands"
          }
    ],
  },
  "VI": {
    code: "VI",
    name: "U.S. Virgin Islands",
    flag: "🇻🇮",
    dialCode: "+1340",
    primaryEmergency: "911",
    primaryLabel: 'DIAL ' + "911",
    services: [
          {
                "id": "vi-emergency",
                "name": "Emergency Services (911)",
                "number": "911",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for U.S. Virgin Islands"
          }
    ],
  },
  "YE": {
    code: "YE",
    name: "Yemen",
    flag: "🇾🇪",
    dialCode: "+967",
    primaryEmergency: "199",
    primaryLabel: 'DIAL ' + "199",
    services: [
          {
                "id": "ye-emergency",
                "name": "Emergency Services (199)",
                "number": "199",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Yemen"
          }
    ],
  },
  "ZM": {
    code: "ZM",
    name: "Zambia",
    flag: "🇿🇲",
    dialCode: "+260",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "zm-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Zambia"
          }
    ],
  },
  "ZW": {
    code: "ZW",
    name: "Zimbabwe",
    flag: "🇿🇼",
    dialCode: "+263",
    primaryEmergency: "999",
    primaryLabel: 'DIAL ' + "999",
    services: [
          {
                "id": "zw-emergency",
                "name": "Emergency Services (999)",
                "number": "999",
                "category": "universal",
                "icon": "alert-circle",
                "description": "Primary emergency dispatch for Zimbabwe"
          }
    ],
  }
};
