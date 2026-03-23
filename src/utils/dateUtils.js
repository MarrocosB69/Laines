const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatDate = (value, locale = "pt-BR") => {
  const date = toDate(value);
  if (!date) return "--/--/----";
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const toLocalDateInputValue = (value = new Date()) => {
  const date = toDate(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateKey = (value) => {
  const date = toDate(value);
  if (!date) return "";
  return toLocalDateInputValue(date);
};

const normalizeStatus = (status) => {
  if (!status) return "Ativo";
  const normalized = String(status).toLowerCase().trim();
  if (normalized === "ativo") return "Ativo";
  if (normalized === "lista de espera" || normalized === "lista_espera") return "Lista de Espera";
  if (normalized === "alta") return "Alta";
  if (normalized === "inativo") return "Inativo";
  if (normalized === "triagem") return "Triagem";
  return status;
};

export { toDate, formatDate, normalizeStatus, toLocalDateInputValue, toDateKey };
