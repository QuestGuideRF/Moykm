import {esc} from './ui.js';
export const makes = {
  Audi: ['A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7'],
  BMW: ['1 серия', '3 серия', '5 серия', 'X1', 'X3', 'X5'],
  Chery: ['Tiggo 4', 'Tiggo 7', 'Tiggo 8'],
  Ford: ['Fiesta', 'Focus', 'Fusion', 'Kuga', 'Mondeo'],
  Geely: ['Atlas', 'Coolray', 'Monjaro'],
  Haval: ['F7', 'Jolion', 'Dargo', 'H9'],
  Honda: ['Civic', 'CR-V', 'Fit', 'Freed', 'Vezel'],
  Hyundai: ['Accent', 'Creta', 'Elantra', 'Santa Fe', 'Solaris', 'Tucson'],
  Kia: ['Ceed', 'Cerato', 'K5', 'Rio', 'Seltos', 'Sportage'],
  LADA: ['Granta', 'Kalina', 'Largus', 'Niva', 'Priora', 'Vesta', 'XRAY'],
  Mazda: ['3', '6', 'CX-3', 'CX-5', 'CX-30', 'Demio', 'MX-5'],
  'Mercedes-Benz': ['A-класс', 'C-класс', 'E-класс', 'GLA', 'GLC', 'GLE'],
  Mitsubishi: ['ASX', 'Lancer', 'Outlander', 'Pajero'],
  Nissan: ['Almera', 'Juke', 'March', 'Murano', 'Note', 'Qashqai', 'Serena', 'Teana', 'Tiida', 'X-Trail'],
  Renault: ['Arkana', 'Duster', 'Kaptur', 'Logan', 'Sandero'],
  'Škoda': ['Fabia', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Superb'],
  Subaru: ['Forester', 'Impreza', 'Legacy', 'Outback', 'XV'],
  Suzuki: ['Grand Vitara', 'Jimny', 'Swift', 'SX4', 'Vitara'],
  Toyota: ['Aqua', 'Camry', 'Corolla', 'Land Cruiser', 'Prius', 'RAV4', 'Vitz', 'Yaris'],
  Volkswagen: ['Golf', 'Jetta', 'Passat', 'Polo', 'Tiguan', 'Touareg'],
};
export const transmissions = {auto: 'Автомат', manual: 'Механика', cvt: 'Вариатор', robot: 'Робот'};
export const engines = {hybrid: 'Гибрид', petrol: 'Бензин', diesel: 'Дизель', gas: 'Газ', other: 'Другой'};
const configurations = {
  LADA: {Vesta: {
    'I': {
      '1.6 · 106 л. с. · 5МТ': {engine: 'petrol', transmission: 'manual', displacement: 1.6, power: 106, drive: 'front', tank_capacity: 55},
      '1.8 · 122 л. с. · 5МТ': {engine: 'petrol', transmission: 'manual', displacement: 1.8, power: 122, drive: 'front', tank_capacity: 55},
      '1.6 · 113 л. с. · CVT': {engine: 'petrol', transmission: 'cvt', displacement: 1.6, power: 113, drive: 'front', tank_capacity: 55},
    },
    'NG': {
      '1.6 · 90 л. с. · 5МТ': {engine: 'petrol', transmission: 'manual', displacement: 1.6, power: 90, drive: 'front', tank_capacity: 55},
      '1.6 · 106 л. с. · 5МТ': {engine: 'petrol', transmission: 'manual', displacement: 1.6, power: 106, drive: 'front', tank_capacity: 55},
    },
  }},
  Nissan: {Note: {E12: {
    '1.2 e-POWER NISMO': {trim: 'e-POWER NISMO', transmission: 'auto', engine: 'hybrid', displacement: 1.2,
      power: 79, year: 2018, drive: 'front', tank_capacity: 41, base_consumption: 5},
  }}},
  'Škoda': {Octavia: {'IV (NX)': {
    '1.5 TSI · 150 л. с. · 6МТ': {engine: 'petrol', transmission: 'manual', displacement: 1.5, power: 150, drive: 'front', tank_capacity: 45},
    '2.0 TDI · 115 л. с. · 6МТ': {engine: 'diesel', transmission: 'manual', displacement: 2, power: 115, drive: 'front', tank_capacity: 45, fuel_type: 'Дизель'},
    '2.0 TDI · 150 л. с. · 7DSG': {engine: 'diesel', transmission: 'robot', displacement: 2, power: 150, drive: 'front', tank_capacity: 45, fuel_type: 'Дизель'},
  }}},
  Toyota: {Camry: {'VIII (XV70)': {
    '2.5 Hybrid · Европа': {transmission: 'cvt', engine: 'hybrid', displacement: 2.5, power: 178, drive: 'front', tank_capacity: 50},
  }}, Corolla: {'XII (E210)': {
    '1.8 Hybrid · Европа (2019–2022)': {transmission: 'cvt', engine: 'hybrid', displacement: 1.8, power: 98, drive: 'front', tank_capacity: 43},
    '2.0 Hybrid · Европа (2019–2022)': {transmission: 'cvt', engine: 'hybrid', displacement: 2, power: 152, drive: 'front', tank_capacity: 43},
  }}, Prius: {
    'IV (XW50)': {'1.8 Hybrid · передний привод': {
      transmission: 'cvt', engine: 'hybrid', displacement: 1.8, power: 98, drive: 'front', tank_capacity: 43, fuel_type: 'АИ-95',
    }},
    'V (XW60)': {'2.0 Plug-in Hybrid · передний привод': {
      transmission: 'cvt', engine: 'hybrid', displacement: 2, power: 152, drive: 'front', tank_capacity: 40,
    }},
  }},
  Mazda: {'MX-5': {
    NC: {
      '1.8 MZR · европейская версия': {transmission: 'manual', engine: 'petrol', displacement: 1.8, power: 126, drive: 'rear'},
      '2.0 MZR · европейская версия': {engine: 'petrol', displacement: 2, power: 160, drive: 'rear'},
    },
  }},
};
export const notePhoto = 'assets/nissan-note-nismo.png';
export const custom = '__custom__';
export const legacy = '__legacy__';
export function modelOptions(brand, selected) {
  const models = makes[brand] || [];
  return `<option value="">Выберите модель</option>${models.map(model =>
    `<option ${selected === model ? 'selected' : ''}>${esc(model)}</option>`).join('')}`
    + `<option value="${custom}" ${selected === custom ? 'selected' : ''}>Другая модель</option>`;
}
export function syncCarSelection(form, reset = false) {
  const {brand_choice: brand, model_choice: model, generation_choice: generation, variant, engine} = form.elements;
  const manual = brand.value === custom;
  const named = brand.value === legacy;
  const catalog = !!brand.value && !manual && !named;
  if (reset) {
    model.innerHTML = modelOptions(brand.value);
  }
  const generations = catalog ? configurations[brand.value]?.[model.value] : null;
  const options = (field, values, placeholder) => {
    const selected = field.value;
    field.replaceChildren(new Option(placeholder, ''), ...values.map(value => new Option(value, value)));
    if (values.includes(selected)) field.value = selected;
  };
  options(generation, Object.keys(generations ?? {}), 'Другое или неизвестно');
  const variants = generations?.[generation.value];
  options(variant, Object.keys(variants ?? {}), 'Другой или неизвестен');
  const manualModel = manual || model.value === custom && catalog;
  for (const [field, enabled] of [[form.elements.brand_custom, manual], [model, catalog],
    [form.elements.model_custom, manualModel], [form.elements.name, named], [generation, Boolean(generations)],
    [variant, Boolean(variants)]]) {
    field.disabled = !enabled;
    field.closest('label').hidden = !enabled;
  }
  form.querySelector('#haldex-choice').hidden = form.elements.drive.value !== 'awd';
  form.querySelector('#car-power-label').textContent = engine.value === 'hybrid' ? 'Мощность ДВС, л. с.' : 'Мощность, л. с.';
}
export function applyCarPreset(form, note = false) {
  const fields = form.elements;
  if (note) {
    resetPresetFields(form);
    fields.brand_choice.value = 'Nissan';
    fields.model_choice.innerHTML = modelOptions('Nissan', 'Note');
    syncCarSelection(form);
    fields.generation_choice.value = 'E12';
    syncCarSelection(form);
    fields.variant.value = '1.2 e-POWER NISMO';
  }
  const generation = fields.generation_choice.value;
  const identified = configurations[fields.brand_choice.value]?.[fields.model_choice.value]?.[generation]?.[fields.variant.value];
  const applied = {};
  for (const [name, value] of Object.entries({...(generation ? {generation} : {}), ...identified})) {
    if (fields[name].value) continue;
    fields[name].value = String(value);
    applied[name] = value;
  }
  form.dataset.presetFields = JSON.stringify(applied);
  syncCarSelection(form);
}
export function resetPresetFields(form) {
  for (const [name, value] of Object.entries(JSON.parse(form.dataset.presetFields || '{}'))) {
    const field = form.elements[name];
    if (field.value === String(value)) field.value = '';
  }
  delete form.dataset.presetFields;
}
export function applyVinCar(form, car, replaceIdentity) {
  const fields = form.elements;
  const specs = car.specs || {};
  if (replaceIdentity && specs.brand && specs.model) {
    const brand = Object.keys(makes).find(item => item.toLowerCase() === specs.brand.toLowerCase());
    fields.brand_choice.value = brand ?? custom;
    fields.brand_custom.value = specs.brand;
    fields.model_custom.value = specs.model;
    if (brand) {
      const model = makes[brand].find(item => item.toLowerCase() === specs.model.toLowerCase());
      fields.model_choice.innerHTML = modelOptions(brand, model ?? custom);
    }
  } else if (replaceIdentity && car.name) {
    fields.brand_choice.value = legacy;
    fields.name.value = car.name;
  }
  const applied = {};
  for (const field of ['year', 'drive', 'tank_capacity', 'base_consumption', 'fuel_type',
    'generation', 'trim', 'engine', 'displacement', 'power', 'transmission']) {
    const value = car[field] ?? specs[field];
    if (value != null && !fields[field].value) {
      fields[field].value = String(value);
      applied[field] = value;
    }
  }
  if (replaceIdentity) form.dataset.presetFields = JSON.stringify(applied);
  if (replaceIdentity && typeof car.haldex === 'boolean') fields.haldex.checked = car.haldex;
  syncCarSelection(form);
}
