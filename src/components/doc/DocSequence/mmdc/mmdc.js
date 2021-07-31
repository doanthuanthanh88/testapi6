#!/usr/bin/env node
'use strict';

process.title = "mmdc";
const commander = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const error = message => {
  console.log(chalk.red(`\n${message}\n`));
  process.exit(1);
};

const convertToValidXML = html => {
  var xml = html;

  // <br> tags in valid HTML (from innerHTML) look like <br>, but they must look like <br/> to be valid XML (such as SVG)
  xml = xml.replace(/<br>/gi, '<br/>');

  return xml;
};

commander.version('1.0')
  .option('-t, --theme [theme]', 'Theme of the chart, could be default, forest, dark or neutral. Optional. Default: default', /^default|forest|dark|neutral$/, 'default')
  .option('-w, --width [width]', 'Width of the page. Optional. Default: 800', /^\d+$/, '800')
  .option('-H, --height [height]', 'Height of the page. Optional. Default: 600', /^\d+$/, '600')
  .option('-i, --input <input>', 'Input mermaid file. Required.')
  .option('-o, --output [output]', 'Output file. It should be either svg, png or pdf. Optional. Default: input + ".svg"')
  .option('-b, --backgroundColor [backgroundColor]', 'Background color. Example: transparent, red, \'#F0F0F0\'. Optional. Default: white')
  .option('-c, --config [config]', 'JSON configuration for mermaid. Optional')
  .option('-C, --cssFile [cssFile]', 'CSS file for the page. Optional')
  .option('-s, --scale [scale]', 'Puppeteer scale factor, default 1. Optional')
  .option('-f, --pdfFit [pdfFit]', 'Scale PDF to fit chart')
  .option('--puppeteerConfig [puppeteerConfig]', 'JSON configuration for puppeteer. Optional')
  .option('--puppeteerPath [puppeteerPath]', 'Path of puppeteer module. Optional')
  .parse(process.argv);

const options = commander.opts();

let { theme, width, height, input, output, backgroundColor, config, cssFile, scale, pdfFit, puppeteerConfig, puppeteerPath = '' } = options;

const puppeteer = require(puppeteerPath || 'puppeteer');

// check input file
if (!(input || inputPipedFromStdin())) {
  error('Please specify input file: -i <input>');
}
const inputs = input.split(',')
const outputs = output.split(',')
for (const input of inputs) {
  if (!fs.existsSync(input)) {
    error(`Input file "${input}" doesn't exist`);
  }
}

for (const output of outputs) {
  if (!output) {
    // if an input file is defined, it should take precedence, otherwise, input is
    // coming from stdin and just name the file out.svg, if it hasn't been
    // specified with the '-o' option
    output = input ? input + '.svg' : 'out.svg';
  }
  if (!/\.(?:svg|png|pdf)$/.test(output)) {
    error(`Output file must end with ".svg", ".png" or ".pdf"`);
  }
  const outputDir = path.dirname(output);
  if (!fs.existsSync(outputDir)) {
    error(`Output directory "${outputDir}/" doesn't exist`);
  }
}

// check config files
let mermaidConfig = {
  theme,
  startOnLoad: true,
  class: {
    useMaxWidth: false,
    diagramPadding: 8
  },
  flowchart: {
    useMaxWidth: false,
    diagramPadding: 8,
    // curve: 'basis',
    // curve: 'linear',
    curve: 'cardinal',
  },
  sequence: {
    diagramMarginX: 8,
    diagramMarginY: 8,
    actorMargin: 24,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
    messageAlign: 'center',
    mirrorActors: false,
    bottomMarginAdj: 1,
    useMaxWidth: false,
    rightAngles: true
  }
};
if (config) {
  mermaidConfig = Object.assign(mermaidConfig, config);
}
// let puppeteerConfig = {
//   // headless: false,
//   // args: [`--window-size=${width},${height}`]
// };
if (puppeteerConfig) {
  puppeteerConfig = JSON.parse(puppeteerConfig)
} else {
  puppeteerConfig = {}
}

// check cssFile
let myCSS;
if (cssFile) {
  if (!fs.existsSync(cssFile)) {
    error(`CSS file "${cssFile}" doesn't exist`);
  }
  myCSS = fs.readFileSync(cssFile, 'utf-8');
}

// normalize args
width = parseInt(width);
height = parseInt(height);
backgroundColor = backgroundColor || 'white';
const deviceScaleFactor = parseInt(scale || 1, 10);

(async () => {
  const browser = await puppeteer.launch(puppeteerConfig);
  try {
    const page = await browser.newPage();
    page.setViewport({ width, height, deviceScaleFactor });
    await page.goto(`file://${path.join(__dirname, 'index.html')}`);
    let containerDiv = ''
    for (let i = 0; i < inputs.length; i++) {
      containerDiv += `<div id="container${i}" class="mermaid"></div>`
    }
    let cssDiv = ''
    if (myCSS) {
      cssDiv = `<style type="text/css">${myCSS}</style>`
    }
    await page.evaluate(`
      document.head.innerHTML += '${cssDiv}';
      document.body.style.backgroundColor = '${backgroundColor}';
      document.getElementById('container').innerHTML = '${containerDiv}';
      window.mermaid.initialize(${JSON.stringify(mermaidConfig)});
    `);
    await Promise.all(inputs.map(async (input, i) => {
      const output = outputs[i]
      const definition = fs.readFileSync(input).toString();
      const result = await page.$eval('#container' + i, function (container, definition) {
        container.textContent = definition;
        // window.mermaid.initialize(mermaidConfig)
        try {
          // window.mermaid.render(container, definition);
          window.mermaid.init(undefined, container);
          return { status: 'success' };
        } catch (error) {
          return { status: 'error', error, message: error.message };
        }
      }, definition);
      if (result.status === 'error') {
        error(result.message);
      }

      if (output.endsWith('svg')) {
        const svg = await page.$eval('#container' + i, function (container) {
          return container.innerHTML;
        });
        const svg_xml = convertToValidXML(svg);
        fs.writeFileSync(output, svg_xml);
      } else if (output.endsWith('png')) {
        const clip = await page.$eval('svg', function (svg) {
          const react = svg.getBoundingClientRect();
          return { x: Math.floor(react.left), y: Math.floor(react.top), width: Math.ceil(react.width), height: Math.ceil(react.height) };
        });
        await page.setViewport({ width: clip.x + clip.width, height: clip.y + clip.height, deviceScaleFactor });
        await page.screenshot({ path: output, clip, omitBackground: backgroundColor === 'transparent' });
      } else {
        // pdf
        if (pdfFit) {
          const clip = await page.$eval('svg', function (svg) {
            const react = svg.getBoundingClientRect();
            return { x: react.left, y: react.top, width: react.width, height: react.height };
          });
          await page.pdf({
            path: output,
            printBackground: backgroundColor !== 'transparent',
            width: Math.ceil(clip.width) + clip.x * 2 + 'px',
            height: Math.ceil(clip.height) + clip.y * 2 + 'px',
            pageRanges: '1-1'
          });
        } else {
          await page.pdf({
            path: output,
            printBackground: backgroundColor !== 'transparent'
          });
        }
      }
    }))
  } finally {
    await browser.close();
  }
})()
