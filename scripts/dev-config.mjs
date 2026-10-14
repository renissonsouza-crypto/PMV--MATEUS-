export function getApiPort(environment = process.env, { allowEphemeral = false } = {}) {
  const value = environment.API_PORT ?? "3001";
  const port = Number(value);
  const minimum = allowEphemeral ? 0 : 1;
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < minimum || port > 65535) {
    throw new Error(`API_PORT deve ser um número inteiro entre ${minimum} e 65535.`);
  }
  return port;
}

export function requireSupportedNode(version = process.versions.node) {
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major) || major < 24) {
    throw new Error(`Node.js ${version} não é compatível com este projeto. Instale o Node.js 24 LTS ou superior e abra um novo terminal.`);
  }
}
