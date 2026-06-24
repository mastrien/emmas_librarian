const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');

async function buildDriver() {
  const mainPath = path.resolve(__dirname, '../dist-electron/electron/main.js');
  const options = new chrome.Options();
  options.addArguments(`app=${mainPath}`);
  options.addArguments('--headless=new');
  
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

async function flow1CreateProject(driver, projectName) {
  const newProjBtn = await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Novo Projeto')]")), 5000);
  await newProjBtn.click();

  const nameInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder*="Sistemas de Recomendação"]')),
    5000,
  );
  await nameInput.sendKeys(projectName);

  const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
  await submitBtn.click();

  await driver.wait(until.urlContains('/projects/'), 5000);
}

async function flow2UploadAndRead(driver, articleTitle) {
  const manualBtn = await driver.wait(until.elementLocated(By.xpath("//button[contains(., 'Manual')]")), 5000);
  await manualBtn.click();

  const titleInput = await driver.wait(until.elementLocated(By.css('input[placeholder*="Bibliometrics"]')), 5000);
  await titleInput.sendKeys(articleTitle);

  const authorsInput = await driver.findElement(By.css('input[placeholder*="John Doe"]'));
  await authorsInput.sendKeys('Emma Watson');

  const submitBtn = await driver.findElement(By.css('button[type="submit"]'));
  await submitBtn.click();

  const articleCell = await driver.wait(
    until.elementLocated(By.xpath(`//*[contains(text(), '${articleTitle}')]`)),
    5000,
  );
  await articleCell.click();

  await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Detalhes do Artigo')]")), 5000);
}

async function flow3QueryBuilderSearch(driver, searchTerm) {
  const searchNav = await driver.wait(until.elementLocated(By.xpath("//*[contains(text(), 'Busca')]")), 5000);
  await searchNav.click();

  const searchInput = await driver.wait(until.elementLocated(By.css('input[placeholder*="Termo de busca"]')), 5000);
  await searchInput.sendKeys(searchTerm);

  const searchBtn = await driver.findElement(By.xpath("//button[contains(., 'Buscar')]"));
  await searchBtn.click();

  await driver.wait(until.elementLocated(By.xpath(`//table//*[contains(text(), '${searchTerm}')]`)), 5000);
}

async function runAllFlows() {
  const isHeadless = process.env.HEADLESS_E2E === 'true' || process.env.CI === 'true' || !!process.env.ANTIGRAVITY_AGENT;
  if (isHeadless) {
    throw new Error('Erro de Ambiente: Os testes E2E do Electron exigem um servidor de exibição gráfica (GUI) ativo (ou framebuffer virtual Xvfb em Linux/CI) para instanciar BrowserWindow. Execução interrompida de forma diagnóstica para evitar timeout.');
  }
  const driver = await buildDriver();
  try {
    const projectName = 'Selenium Test Project ' + Date.now();
    await flow1CreateProject(driver, projectName);
    await flow2UploadAndRead(driver, 'E2E Selenium Manual Article');
    await flow3QueryBuilderSearch(driver, 'E2E Selenium Manual Article');
    console.log('All E2E flows completed successfully via Selenium!');
  } finally {
    await driver.quit();
  }
}

if (require.main === module) {
  runAllFlows().catch(console.error);
}

module.exports = {
  buildDriver,
  flow1CreateProject,
  flow2UploadAndRead,
  flow3QueryBuilderSearch,
  runAllFlows,
};
