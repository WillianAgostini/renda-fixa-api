import { Injectable, Logger, Scope } from '@nestjs/common';
import { Page } from 'puppeteer';
import { NewSimulateDto } from 'src/simulation/dto/new-simulate-dto';
import { BrowserService } from './browser/browser.service';
import { StorageService } from './storage/storage.service';
import { UrlService } from './url/url.service';

@Injectable({
  scope: Scope.DEFAULT,
})
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private storageService: StorageService,
    private urlService: UrlService,
    private browserService: BrowserService,
  ) {}

  async simulate(newSimulateDto: NewSimulateDto) {
    this.logger.debug('init');

    const url = 'https://infograficos.valor.globo.com/calculadoras/calculadora-de-renda-fixa.html#ancor';

    const page = await this.getPage(url);

    await page.evaluate(() => {
      document.getElementById('investimento_inicial').removeAttribute('disabled');
      document.getElementById('aporte_iniciais').removeAttribute('disabled');
      document.getElementById('periodo').removeAttribute('disabled');
    });

    await page.type('#investimento_inicial', newSimulateDto.initialValue);
    await page.type('#aporte_iniciais', newSimulateDto.monthlyValue);
    await page.type('#periodo', newSimulateDto.period);

    await page.click('.btn-calcular');

    await page.waitForSelector('#result_cap_init');

    const [resultCapInit, resultAporte, resultPeriodo, resultCapTotal, tableHeaders, tableData] = await Promise.all([
      page.$eval('#result_cap_init', (el) => el.textContent.trim()),
      page.$eval('#result_aporte', (el) => el.textContent.trim()),
      page.$eval('#result_periodo', (el) => el.textContent.trim()),
      page.$eval('#result_cap_total', (el) => el.textContent.trim()),
      page.$$eval('.tabela thead th', (headers) => headers.map((th) => th.textContent.trim())),
      page.$$eval('.tabela tbody tr', (rows) =>
        Array.from(rows, (row) => {
          const columns = row.querySelectorAll('td');
          return Array.from(columns, (column) => column.textContent.trim());
        }),
      ),
    ]);

    const jsonResult = {
      initialInvestedValue: resultCapInit,
      monthlyContributions: resultAporte,
      applicationPeriod: resultPeriodo,
      totalInvestedValue: resultCapTotal,
      results: {},
      attributes: {},
    };

    for (let i = 1; i < 8; i++) {
      jsonResult.results[tableHeaders[i]] = {
        accumulatedGrossValue: tableData[0][i],
        grossProfitability: tableData[1][i],
        costs: tableData[2][i],
        taxesPaid: tableData[3][i],
        accumulatedNetValue: tableData[4][i],
        netProfitability: tableData[5][i],
        netGain: tableData[6][i],
      };
    }

    jsonResult.attributes = await this.getFees(page);

    await page.close();
    this.logger.debug('finish');
    return jsonResult;
  }

  private async getFees(page: Page) {
    const [taxaSelic, taxaCdi, ipca, tr, tesouroPre, taxaCustodia, tesouroIpca, taxaAdmFundoDi, rentabCdb, rentabFundoDi, rentabLciLca, taxaPoupanca] =
      await Promise.all([
        page.$eval('#taxa_selic', (el) => el.getAttribute('data-default')),
        page.$eval('#taxa_cdi', (el) => el.getAttribute('data-default')),
        page.$eval('#ipca', (el) => el.getAttribute('data-default')),
        page.$eval('#tr', (el) => el.getAttribute('data-default')),
        page.$eval('#tesouro_pre', (el) => el.getAttribute('data-default')),
        page.$eval('#taxa_custodia', (el) => el.getAttribute('data-default')),
        page.$eval('#tesouro_ipca', (el) => el.getAttribute('data-default')),
        page.$eval('#taxa_adm_fundo_di', (el) => el.getAttribute('data-default')),
        page.$eval('#rentab_cdb', (el) => el.getAttribute('data-default')),
        page.$eval('#rentab_fundo_di', (el) => el.getAttribute('data-default')),
        page.$eval('#rentab_lci_lca', (el) => el.getAttribute('data-default')),
        page.$eval('#taxa_poupanca', (el) => el.getAttribute('data-default')),
      ]);

    return {
      taxaSelic,
      taxaCdi,
      ipca,
      tr,
      tesouroPre,
      taxaCustodia,
      tesouroIpca,
      taxaAdmFundoDi,
      rentabCdb,
      rentabFundoDi,
      rentabLciLca,
      taxaPoupanca,
    };
  }

  private async getPage(url: string): Promise<Page> {
    const cache = this.storageService.getCache();

    const page = await this.browserService.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const requestUrl = request.url();
      const content = this.urlService.shouldIgnore(requestUrl) && cache[requestUrl];
      if (content) {
        try {
          await request.respond(content);
        } catch (error) {
          request.continue();
          this.urlService.appendIgnoredUrls(requestUrl);
        } finally {
          return;
        }
      }
      request.continue();
    });

    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (this.urlService.shouldIgnore(responseUrl) && !cache[responseUrl]) {
        try {
          const buffer = await response.buffer();
          cache[responseUrl] = {
            status: response.status(),
            headers: response.headers(),
            body: buffer,
          };
        } catch (error) {
          // some responses do not contain buffer and do not need to be caught
          return;
        }
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    this.storageService.update(cache);
    await page.setViewport({ width: 1080, height: 1024 });
    return page;
  }
}
