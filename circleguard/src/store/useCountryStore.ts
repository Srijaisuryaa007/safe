import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EmergencyServiceItem {
  id: string;
  name: string;
  number: string;
  category: 'police' | 'medical' | 'fire' | 'universal' | 'women' | 'child' | 'special';
  icon: string;
  description: string;
}

export interface CountryInfo {
  code: string; // ISO 2-letter
  name: string;
  flag: string;
  dialCode: string;
  primaryEmergency: string;
  primaryLabel: string;
  services: EmergencyServiceItem[];
}

export const SUPPORTED_COUNTRIES: Record<string, CountryInfo> = {
  IN: {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    dialCode: '+91',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 100',
    services: [
      { id: 'in-police', name: 'Police Emergency', number: '100', category: 'police', icon: 'shield-checkmark', description: 'Instant Police Dispatch & Patrol Response' },
      { id: 'in-ambulance', name: 'Ambulance & Medical', number: '108', category: 'medical', icon: 'medical', description: 'Emergency Medical & Trauma Services (108 / 102)' },
      { id: 'in-fire', name: 'Fire & Rescue', number: '101', category: 'fire', icon: 'flame', description: 'Fire Brigade & Disaster Relief Operations' },
      { id: 'in-erss', name: 'National ERSS (All-in-One)', number: '112', category: 'universal', icon: 'alert-circle', description: 'Unified Emergency Response Support System' },
      { id: 'in-women', name: 'Women Helpline', number: '1091', category: 'women', icon: 'heart', description: 'Dedicated 24x7 Safety & Distress Support' },
      { id: 'in-child', name: 'Childline Emergency', number: '1098', category: 'child', icon: 'people', description: 'National Child Protection Emergency' },
    ],
  },
  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    dialCode: '+1',
    primaryEmergency: '911',
    primaryLabel: 'DIAL 911',
    services: [
      { id: 'us-911', name: 'Emergency Services (911)', number: '911', category: 'universal', icon: 'alert-circle', description: 'Unified Police, Fire, and Paramedic Dispatch' },
      { id: 'us-poison', name: 'Poison Control Hotline', number: '18002221222', category: 'medical', icon: 'medkit', description: 'National Poison Assistance & Triage' },
    ],
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    dialCode: '+44',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'gb-999', name: 'Emergency Services (999)', number: '999', category: 'universal', icon: 'alert-circle', description: 'Police, Fire, and Ambulance Emergency Dispatch' },
      { id: 'gb-101', name: 'Police Non-Emergency', number: '101', category: 'police', icon: 'shield-checkmark', description: 'Non-emergency crime reporting & support' },
      { id: 'gb-111', name: 'NHS Medical Advice', number: '111', category: 'medical', icon: 'medical', description: 'Urgent medical assessment and clinical advice' },
    ],
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    dialCode: '+1',
    primaryEmergency: '911',
    primaryLabel: 'DIAL 911',
    services: [
      { id: 'ca-911', name: 'Emergency Services (911)', number: '911', category: 'universal', icon: 'alert-circle', description: 'Police, Fire, and Paramedic Emergency Dispatch' },
    ],
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    dialCode: '+61',
    primaryEmergency: '000',
    primaryLabel: 'DIAL 000',
    services: [
      { id: 'au-000', name: 'Triple Zero (000)', number: '000', category: 'universal', icon: 'alert-circle', description: 'Primary Police, Fire, and Ambulance dispatch' },
      { id: 'au-ses', name: 'State Emergency Service', number: '132500', category: 'special', icon: 'thunderstorm', description: 'Storm and flood disaster assistance' },
    ],
  },
  AE: {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    dialCode: '+971',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'ae-police', name: 'Police Emergency', number: '999', category: 'police', icon: 'shield-checkmark', description: 'Police Rescue & Dispatch' },
      { id: 'ae-ambulance', name: 'Ambulance Services', number: '998', category: 'medical', icon: 'medical', description: 'National Ambulance Emergency Hotline' },
      { id: 'ae-fire', name: 'Civil Defence (Fire)', number: '997', category: 'fire', icon: 'flame', description: 'Civil Defence and Fire Rescue' },
    ],
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    dialCode: '+65',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999 / 995',
    services: [
      { id: 'sg-police', name: 'Singapore Police Force', number: '999', category: 'police', icon: 'shield-checkmark', description: 'Emergency Police Dispatch' },
      { id: 'sg-scdf', name: 'Ambulance & Fire (SCDF)', number: '995', category: 'medical', icon: 'flame', description: 'Civil Defence Emergency Ambulance & Fire' },
    ],
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    dialCode: '+49',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 110',
    services: [
      { id: 'de-112', name: 'Fire & Medical Emergency', number: '112', category: 'universal', icon: 'medical', description: 'Feuerwehr & Rettungsdienst' },
      { id: 'de-110', name: 'Police Emergency', number: '110', category: 'police', icon: 'shield-checkmark', description: 'Polizei Notruf' },
    ],
  },
  FR: {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    dialCode: '+33',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 15',
    services: [
      { id: 'fr-112', name: 'European Emergency (112)', number: '112', category: 'universal', icon: 'alert-circle', description: 'Numéro d’urgence européen' },
      { id: 'fr-15', name: 'SAMU (Ambulance)', number: '15', category: 'medical', icon: 'medical', description: 'Service d’Aide Médicale Urgente' },
      { id: 'fr-17', name: 'Police Secours', number: '17', category: 'police', icon: 'shield-checkmark', description: 'Police & Gendarmerie' },
      { id: 'fr-18', name: 'Pompiers (Fire)', number: '18', category: 'fire', icon: 'flame', description: 'Sapeurs-Pompiers' },
    ],
  },
  IT: {
    code: 'IT',
    name: 'Italy',
    flag: '🇮🇹',
    dialCode: '+39',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'it-112', name: 'Numero Unico Europeo (112)', number: '112', category: 'universal', icon: 'alert-circle', description: 'Carabinieri & Polizia' },
      { id: 'it-118', name: 'Emergenza Sanitaria', number: '118', category: 'medical', icon: 'medical', description: 'Ambulanza & Soccorso Sanitario' },
      { id: 'it-115', name: 'Vigili del Fuoco (Fire)', number: '115', category: 'fire', icon: 'flame', description: 'Vigili del Fuoco' },
    ],
  },
  ES: {
    code: 'ES',
    name: 'Spain',
    flag: '🇪🇸',
    dialCode: '+34',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'es-112', name: 'Emergencias 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Servicio de Emergencias General' },
      { id: 'es-091', name: 'Policía Nacional', number: '091', category: 'police', icon: 'shield-checkmark', description: 'Policía Nacional' },
      { id: 'es-061', name: 'Urgencias Médicas', number: '061', category: 'medical', icon: 'medical', description: 'Ambulancia y Urgencias Sanitarias' },
    ],
  },
  JP: {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    dialCode: '+81',
    primaryEmergency: '110',
    primaryLabel: 'DIAL 110 / 119',
    services: [
      { id: 'jp-110', name: 'Police Emergency (110)', number: '110', category: 'police', icon: 'shield-checkmark', description: 'Keisatsu (Police Dispatch)' },
      { id: 'jp-119', name: 'Fire & Ambulance (119)', number: '119', category: 'medical', icon: 'medical', description: 'Shoubou & Kyuukyuu' },
    ],
  },
  KR: {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    dialCode: '+82',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 119',
    services: [
      { id: 'kr-112', name: 'Police Emergency (112)', number: '112', category: 'police', icon: 'shield-checkmark', description: 'Korean National Police Dispatch' },
      { id: 'kr-119', name: 'Fire & Ambulance (119)', number: '119', category: 'medical', icon: 'flame', description: 'National Fire Agency & Rescue' },
    ],
  },
  CN: {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    dialCode: '+86',
    primaryEmergency: '110',
    primaryLabel: 'DIAL 110 / 120',
    services: [
      { id: 'cn-110', name: 'Police Dispatch (110)', number: '110', category: 'police', icon: 'shield-checkmark', description: 'Public Security Police' },
      { id: 'cn-120', name: 'Medical Emergency (120)', number: '120', category: 'medical', icon: 'medical', description: 'First Aid Ambulance' },
      { id: 'cn-119', name: 'Fire & Rescue (119)', number: '119', category: 'fire', icon: 'flame', description: 'Fire Department' },
    ],
  },
  BR: {
    code: 'BR',
    name: 'Brazil',
    flag: '🇧🇷',
    dialCode: '+55',
    primaryEmergency: '190',
    primaryLabel: 'DIAL 190 / 192',
    services: [
      { id: 'br-190', name: 'Polícia Militar (190)', number: '190', category: 'police', icon: 'shield-checkmark', description: 'Polícia Militar' },
      { id: 'br-192', name: 'SAMU (Ambulance 192)', number: '192', category: 'medical', icon: 'medical', description: 'Serviço de Atendimento Móvel' },
      { id: 'br-193', name: 'Bombeiros (Fire 193)', number: '193', category: 'fire', icon: 'flame', description: 'Corpo de Bombeiros' },
    ],
  },
  MX: {
    code: 'MX',
    name: 'Mexico',
    flag: '🇲🇽',
    dialCode: '+52',
    primaryEmergency: '911',
    primaryLabel: 'DIAL 911',
    services: [
      { id: 'mx-911', name: 'Emergencias 911', number: '911', category: 'universal', icon: 'alert-circle', description: 'Policía, Cruz Roja y Bomberos' },
    ],
  },
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    dialCode: '+966',
    primaryEmergency: '911',
    primaryLabel: 'DIAL 911 / 999',
    services: [
      { id: 'sa-911', name: 'Unified Emergency (911)', number: '911', category: 'universal', icon: 'alert-circle', description: 'Unified Security Operations Center' },
      { id: 'sa-997', name: 'Red Crescent (Ambulance)', number: '997', category: 'medical', icon: 'medical', description: 'Saudi Red Crescent Authority' },
      { id: 'sa-998', name: 'Civil Defense (Fire)', number: '998', category: 'fire', icon: 'flame', description: 'Civil Defense' },
    ],
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    dialCode: '+27',
    primaryEmergency: '10111',
    primaryLabel: 'DIAL 10111 / 112',
    services: [
      { id: 'za-10111', name: 'Police Flying Squad (10111)', number: '10111', category: 'police', icon: 'shield-checkmark', description: 'SAPS Emergency Police Dispatch' },
      { id: 'za-10177', name: 'Ambulance & Fire (10177)', number: '10177', category: 'medical', icon: 'medical', description: 'Emergency Medical & Fire Services' },
      { id: 'za-112', name: 'Cellular Emergency (112)', number: '112', category: 'universal', icon: 'alert-circle', description: 'National Mobile Emergency Routing' },
    ],
  },
  NZ: {
    code: 'NZ',
    name: 'New Zealand',
    flag: '🇳🇿',
    dialCode: '+64',
    primaryEmergency: '111',
    primaryLabel: 'DIAL 111',
    services: [
      { id: 'nz-111', name: 'Emergency 111', number: '111', category: 'universal', icon: 'alert-circle', description: 'Police, Fire, and Ambulance' },
    ],
  },
  MY: {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    dialCode: '+60',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'my-999', name: 'MERS 999', number: '999', category: 'universal', icon: 'alert-circle', description: 'Malaysia Emergency Response Services' },
    ],
  },
  ID: {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    dialCode: '+62',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 110',
    services: [
      { id: 'id-112', name: 'Layanan Darurat 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Panggilan Darurat Terpadu' },
      { id: 'id-110', name: 'Polisi (110)', number: '110', category: 'police', icon: 'shield-checkmark', description: 'Kepolisian Republik Indonesia' },
      { id: 'id-118', name: 'Ambulans (118)', number: '118', category: 'medical', icon: 'medical', description: 'Ambulans dan Gawat Darurat' },
    ],
  },
  PH: {
    code: 'PH',
    name: 'Philippines',
    flag: '🇵🇭',
    dialCode: '+63',
    primaryEmergency: '911',
    primaryLabel: 'DIAL 911',
    services: [
      { id: 'ph-911', name: 'Emergency 911', number: '911', category: 'universal', icon: 'alert-circle', description: 'National Emergency 911 Hotline' },
    ],
  },
  TH: {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    dialCode: '+66',
    primaryEmergency: '191',
    primaryLabel: 'DIAL 191 / 1669',
    services: [
      { id: 'th-191', name: 'Police Emergency (191)', number: '191', category: 'police', icon: 'shield-checkmark', description: 'Royal Thai Police Dispatch' },
      { id: 'th-1669', name: 'Medical Emergency (1669)', number: '1669', category: 'medical', icon: 'medical', description: 'National Institute for Emergency Medicine' },
      { id: 'th-199', name: 'Fire & Rescue (199)', number: '199', category: 'fire', icon: 'flame', description: 'Fire & Disaster Prevention' },
    ],
  },
  VN: {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    dialCode: '+84',
    primaryEmergency: '113',
    primaryLabel: 'DIAL 113 / 115',
    services: [
      { id: 'vn-113', name: 'Police (113)', number: '113', category: 'police', icon: 'shield-checkmark', description: 'Cảnh sát phản ứng nhanh' },
      { id: 'vn-115', name: 'Ambulance (115)', number: '115', category: 'medical', icon: 'medical', description: 'Cấp cứu y tế' },
      { id: 'vn-114', name: 'Fire (114)', number: '114', category: 'fire', icon: 'flame', description: 'Cứu hỏa và cứu hộ' },
    ],
  },
  PK: {
    code: 'PK',
    name: 'Pakistan',
    flag: '🇵🇰',
    dialCode: '+92',
    primaryEmergency: '15',
    primaryLabel: 'DIAL 15 / 1122',
    services: [
      { id: 'pk-15', name: 'Police Emergency (15)', number: '15', category: 'police', icon: 'shield-checkmark', description: 'Police Madadgar 15' },
      { id: 'pk-1122', name: 'Rescue 1122', number: '1122', category: 'medical', icon: 'medical', description: 'Emergency Rescue & Ambulance' },
    ],
  },
  BD: {
    code: 'BD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    dialCode: '+880',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'bd-999', name: 'National Emergency 999', number: '999', category: 'universal', icon: 'alert-circle', description: 'Police, Fire, and Ambulance Dispatch' },
    ],
  },
  LK: {
    code: 'LK',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    dialCode: '+94',
    primaryEmergency: '119',
    primaryLabel: 'DIAL 119 / 1990',
    services: [
      { id: 'lk-119', name: 'Police Emergency (119)', number: '119', category: 'police', icon: 'shield-checkmark', description: 'Sri Lanka Police Emergency' },
      { id: 'lk-1990', name: 'Suwa Seriya Ambulance (1990)', number: '1990', category: 'medical', icon: 'medical', description: '1990 Suwa Seriya Free Ambulance' },
    ],
  },
  NP: {
    code: 'NP',
    name: 'Nepal',
    flag: '🇳🇵',
    dialCode: '+977',
    primaryEmergency: '100',
    primaryLabel: 'DIAL 100 / 102',
    services: [
      { id: 'np-100', name: 'Police Emergency (100)', number: '100', category: 'police', icon: 'shield-checkmark', description: 'Nepal Police Control' },
      { id: 'np-102', name: 'Ambulance (102)', number: '102', category: 'medical', icon: 'medical', description: 'Nepal Red Cross Ambulance' },
    ],
  },
  TR: {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    dialCode: '+90',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'tr-112', name: '112 Acil Çağrı', number: '112', category: 'universal', icon: 'alert-circle', description: 'Polis, Ambulans ve İtfaiye Ortak Hattı' },
    ],
  },
  RU: {
    code: 'RU',
    name: 'Russia',
    flag: '🇷🇺',
    dialCode: '+7',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'ru-112', name: 'Служба 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Единая служба экстренной помощи' },
      { id: 'ru-102', name: 'Полиция (102)', number: '102', category: 'police', icon: 'shield-checkmark', description: 'Полиция' },
      { id: 'ru-103', name: 'Скорая помощь (103)', number: '103', category: 'medical', icon: 'medical', description: 'Скорая медицинская помощь' },
    ],
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    flag: '🇳🇱',
    dialCode: '+31',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'nl-112', name: 'Alarmnummer 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Politie, Brandweer en Ambulance' },
    ],
  },
  CH: {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    dialCode: '+41',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 117',
    services: [
      { id: 'ch-112', name: 'European Emergency (112)', number: '112', category: 'universal', icon: 'alert-circle', description: 'Allgemeiner Notruf' },
      { id: 'ch-117', name: 'Polizei (117)', number: '117', category: 'police', icon: 'shield-checkmark', description: 'Polizei Notruf' },
      { id: 'ch-144', name: 'Sanitätsnotruf (144)', number: '144', category: 'medical', icon: 'medical', description: 'Ambulanz & Rettungsdienst' },
    ],
  },
  SE: {
    code: 'SE',
    name: 'Sweden',
    flag: '🇸🇪',
    dialCode: '+46',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'se-112', name: 'SOS Alarm 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Polis, Ambulans och Räddningstjänst' },
    ],
  },
  NO: {
    code: 'NO',
    name: 'Norway',
    flag: '🇳🇴',
    dialCode: '+47',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 113',
    services: [
      { id: 'no-112', name: 'Politi (112)', number: '112', category: 'police', icon: 'shield-checkmark', description: 'Politi Nødanrop' },
      { id: 'no-113', name: 'Ambulanse (113)', number: '113', category: 'medical', icon: 'medical', description: 'Medisinsk Nødhjelp' },
    ],
  },
  DK: {
    code: 'DK',
    name: 'Denmark',
    flag: '🇩🇰',
    dialCode: '+45',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'dk-112', name: 'Alarm 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Politi, Ambulance og Brandvæsen' },
    ],
  },
  FI: {
    code: 'FI',
    name: 'Finland',
    flag: '🇫🇮',
    dialCode: '+358',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'fi-112', name: 'Hätäkeskus 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Poliisi, Ensihoito ja Pelastustoimi' },
    ],
  },
  PL: {
    code: 'PL',
    name: 'Poland',
    flag: '🇵🇱',
    dialCode: '+48',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 997',
    services: [
      { id: 'pl-112', name: 'Numer Alarmowy 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Centrum Powiadamiania Ratunkowego' },
      { id: 'pl-997', name: 'Policja (997)', number: '997', category: 'police', icon: 'shield-checkmark', description: 'Policja' },
      { id: 'pl-999', name: 'Pogotowie Ratunkowe (999)', number: '999', category: 'medical', icon: 'medical', description: 'Pogotowie Ratunkowe' },
    ],
  },
  IE: {
    code: 'IE',
    name: 'Ireland',
    flag: '🇮🇪',
    dialCode: '+353',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 999',
    services: [
      { id: 'ie-112', name: 'Emergency 112 / 999', number: '112', category: 'universal', icon: 'alert-circle', description: 'Gardaí, Ambulance, and Fire Brigade' },
    ],
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    dialCode: '+351',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'pt-112', name: 'Número de Emergência 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Polícia, INEM e Bombeiros' },
    ],
  },
  GR: {
    code: 'GR',
    name: 'Greece',
    flag: '🇬🇷',
    dialCode: '+30',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 100',
    services: [
      { id: 'gr-112', name: 'European Emergency (112)', number: '112', category: 'universal', icon: 'alert-circle', description: 'Ευρωπαϊκός Αριθμός Έκτακτης Ανάγκης' },
      { id: 'gr-100', name: 'Police (100)', number: '100', category: 'police', icon: 'shield-checkmark', description: 'Άμεση Δράση' },
      { id: 'gr-166', name: 'Ambulance (166)', number: '166', category: 'medical', icon: 'medical', description: 'ΕΚΑΒ' },
    ],
  },
  AT: {
    code: 'AT',
    name: 'Austria',
    flag: '🇦🇹',
    dialCode: '+43',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 133',
    services: [
      { id: 'at-112', name: 'Euronotruf 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Euronotruf' },
      { id: 'at-133', name: 'Polizei (133)', number: '133', category: 'police', icon: 'shield-checkmark', description: 'Polizei' },
      { id: 'at-144', name: 'Rettung (144)', number: '144', category: 'medical', icon: 'medical', description: 'Rettungsdienst' },
    ],
  },
  BE: {
    code: 'BE',
    name: 'Belgium',
    flag: '🇧🇪',
    dialCode: '+32',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 101',
    services: [
      { id: 'be-112', name: 'Emergency 112 (Medical/Fire)', number: '112', category: 'universal', icon: 'alert-circle', description: 'Ambulance en Brandweer' },
      { id: 'be-101', name: 'Federal Police (101)', number: '101', category: 'police', icon: 'shield-checkmark', description: 'Federale Politie' },
    ],
  },
  EG: {
    code: 'EG',
    name: 'Egypt',
    flag: '🇪🇬',
    dialCode: '+20',
    primaryEmergency: '122',
    primaryLabel: 'DIAL 122 / 123',
    services: [
      { id: 'eg-122', name: 'Police (122)', number: '122', category: 'police', icon: 'shield-checkmark', description: 'Egyptian Police' },
      { id: 'eg-123', name: 'Ambulance (123)', number: '123', category: 'medical', icon: 'medical', description: 'Egyptian Ambulance Authority' },
    ],
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    dialCode: '+234',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 199',
    services: [
      { id: 'ng-112', name: 'Emergency Communications (112)', number: '112', category: 'universal', icon: 'alert-circle', description: 'National Emergency Communications Centre' },
    ],
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    flag: '🇰🇪',
    dialCode: '+254',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999 / 112',
    services: [
      { id: 'ke-999', name: 'Emergency Police (999)', number: '999', category: 'universal', icon: 'alert-circle', description: 'Kenya Police & Ambulance' },
    ],
  },
  AR: {
    code: 'AR',
    name: 'Argentina',
    flag: '🇦🇷',
    dialCode: '+54',
    primaryEmergency: '911',
    primaryLabel: 'DIAL 911 / 107',
    services: [
      { id: 'ar-911', name: 'Emergencias 911', number: '911', category: 'universal', icon: 'alert-circle', description: 'Central de Emergencias' },
      { id: 'ar-107', name: 'SAME Ambulancia (107)', number: '107', category: 'medical', icon: 'medical', description: 'SAME Emergencias Médicas' },
    ],
  },
  CL: {
    code: 'CL',
    name: 'Chile',
    flag: '🇨🇱',
    dialCode: '+56',
    primaryEmergency: '133',
    primaryLabel: 'DIAL 133 / 131',
    services: [
      { id: 'cl-133', name: 'Carabineros (133)', number: '133', category: 'police', icon: 'shield-checkmark', description: 'Carabineros de Chile' },
      { id: 'cl-131', name: 'SAMU Ambulancia (131)', number: '131', category: 'medical', icon: 'medical', description: 'SAMU Urgencias' },
    ],
  },
  CO: {
    code: 'CO',
    name: 'Colombia',
    flag: '🇨🇴',
    dialCode: '+57',
    primaryEmergency: '123',
    primaryLabel: 'DIAL 123',
    services: [
      { id: 'co-123', name: 'Línea de Emergencias 123', number: '123', category: 'universal', icon: 'alert-circle', description: 'Policía Nacional y Cruz Roja' },
    ],
  },
  QA: {
    code: 'QA',
    name: 'Qatar',
    flag: '🇶🇦',
    dialCode: '+974',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'qa-999', name: 'Emergency 999', number: '999', category: 'universal', icon: 'alert-circle', description: 'Unified Police, Ambulance, and Fire' },
    ],
  },
  KW: {
    code: 'KW',
    name: 'Kuwait',
    flag: '🇰🇼',
    dialCode: '+965',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112',
    services: [
      { id: 'kw-112', name: 'Unified Emergency 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Kuwait Emergency Operations' },
    ],
  },
  OM: {
    code: 'OM',
    name: 'Oman',
    flag: '🇴🇲',
    dialCode: '+968',
    primaryEmergency: '9999',
    primaryLabel: 'DIAL 9999',
    services: [
      { id: 'om-9999', name: 'Royal Oman Police 9999', number: '9999', category: 'universal', icon: 'alert-circle', description: 'Police, Ambulance and Civil Defence' },
    ],
  },
  BH: {
    code: 'BH',
    name: 'Bahrain',
    flag: '🇧🇭',
    dialCode: '+973',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'bh-999', name: 'Emergency 999', number: '999', category: 'universal', icon: 'alert-circle', description: 'Ministry of Interior Emergency Operations' },
    ],
  },
  HK: {
    code: 'HK',
    name: 'Hong Kong',
    flag: '🇭🇰',
    dialCode: '+852',
    primaryEmergency: '999',
    primaryLabel: 'DIAL 999',
    services: [
      { id: 'hk-999', name: 'Emergency 999', number: '999', category: 'universal', icon: 'alert-circle', description: 'Hong Kong Police & Fire Services' },
    ],
  },
  TW: {
    code: 'TW',
    name: 'Taiwan',
    flag: '🇹🇼',
    dialCode: '+886',
    primaryEmergency: '110',
    primaryLabel: 'DIAL 110 / 119',
    services: [
      { id: 'tw-110', name: 'Police (110)', number: '110', category: 'police', icon: 'shield-checkmark', description: 'National Police Agency' },
      { id: 'tw-119', name: 'Fire & Ambulance (119)', number: '119', category: 'medical', icon: 'medical', description: 'National Fire Agency' },
    ],
  },
  CZ: {
    code: 'CZ',
    name: 'Czech Republic',
    flag: '🇨🇿',
    dialCode: '+420',
    primaryEmergency: '112',
    primaryLabel: 'DIAL 112 / 158',
    services: [
      { id: 'cz-112', name: 'Tísňová linka 112', number: '112', category: 'universal', icon: 'alert-circle', description: 'Jednotné evropské číslo tísňového volání' },
      { id: 'cz-158', name: 'Policie (158)', number: '158', category: 'police', icon: 'shield-checkmark', description: 'Policie ČR' },
      { id: 'cz-155', name: 'Záchranná služba (155)', number: '155', category: 'medical', icon: 'medical', description: 'Zdravotnická záchranná služba' },
    ],
  },
};

const STORAGE_KEY = '@circleguard_selected_country_code';

interface CountryState {
  countryCode: string;
  country: CountryInfo;
  setCountryCode: (code: string) => Promise<void>;
  initCountry: () => Promise<void>;
}

export const useCountryStore = create<CountryState>((set, get) => ({
  countryCode: 'IN',
  country: SUPPORTED_COUNTRIES.IN,
  setCountryCode: async (code: string) => {
    const selected = SUPPORTED_COUNTRIES[code] || SUPPORTED_COUNTRIES.IN;
    set({
      countryCode: selected.code,
      country: selected,
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, selected.code);
    } catch (e) {}
  },
  initCountry: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_COUNTRIES[stored]) {
        const c = SUPPORTED_COUNTRIES[stored];
        set({ countryCode: c.code, country: c });
      } else {
        // Default to India
        set({ countryCode: 'IN', country: SUPPORTED_COUNTRIES.IN });
      }
    } catch (e) {
      set({ countryCode: 'IN', country: SUPPORTED_COUNTRIES.IN });
    }
  },
}));
