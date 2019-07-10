'use strict';

const { readdirSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

const reportIds = [];
const featureMap = {};

function readFeaturesFromJsonFile(path) {
    const featuresJson = readFileSync(path, { encoding: 'utf8' });
    return JSON.parse(featuresJson);
}

function mergeFeatures(reportId, features) {
    features.forEach(feature => {
        const featureId = feature.uri;
        const featureEntry = createFeatureMapEntry(featureId, feature);
        const scenarioMap = featureEntry.scenarioMap;
        feature.elements.forEach(scenario => {
            const scenarioEntry = createScenarioMapEntry(scenario, scenarioMap);
            scenarioEntry.runs[reportId] = scenario;
        });
    });
}

function createFeatureMapEntry(featureId, feature) {
    const featureEntry = featureMap[featureId];
    if (featureEntry) {
        return featureEntry;
    }
    return featureMap[featureId] = {
        description: feature.description,
        name: feature.name,
        scenarioMap: {}
    };
}

function createScenarioMapEntry(scenario, scenarioMap) {
    const scenarioId = `${scenario.id}+line:${scenario.line}`;
    const scenarioEntry = scenarioMap[scenarioId];
    if (scenarioEntry) {
        return scenarioEntry;
    }
    return scenarioMap[scenarioId] = {
        name: scenario.name,
        runs: {}
    };
}

function readCssFile(fileName) {
    return readFileSync(path.join(__dirname, fileName), { encoding: 'utf8' })
}

function generateHtmlHead() {
    return `
        <head>
            <style>${readCssFile('report.css')}</style>
            <style>${readCssFile('tooltip.css')}</style>
        </head>
    `;
}

function generateFeatureRow(featureEntry, reportIds) {
    let html = `<tr class="feature-row"><th>${featureEntry.name}`;
    if (featureEntry.description) {
        html += `<div class="feature-description">${featureEntry.description}</div>`;
    }
    html += '</th>';
    reportIds.forEach(reportId => html += `<th class="report-id">${reportId}</th>`);
    html += '</tr>'
    return html;
}

function generateScenarioRow(scenarioEntry, reportIds) {
    let html = `<tr class="scenario-row"><td class="scenario-description">${scenarioEntry.name}</td>`
    reportIds.forEach(reportId => {
        const run = scenarioEntry.runs[reportId];
        if (!run) {
            html += '<td></td>';
            return;
        }
        html += generateScenarioStatusCell(run);
    });
    html += '</tr>';
    return html;
}

function hasStepFailed(step) {
    return step.result.status === 'failed';
}

function generateScenarioStatusCell(scenarioRun) {
    const steps = scenarioRun.steps;
    const hasStepFailure = !!steps.find(step => hasStepFailed(step));
    if (hasStepFailure) {
        return `
            <td class="scenario-status scenario-status-failed tooltip">
                &#10008
                <div class="tooltiptext">${generateScenarioStepList(scenarioRun)}</div>
            </td>`;
    }
    return '<td class="scenario-status scenario-status-passed">&#10003</td>';
}

function generateScenarioStepList(scenarioRun) {
    const steps = scenarioRun.steps;
    let html = '<div>';
    steps.forEach((step, stepIndex) => {
        const stepName = step.name;
        const hasFailed = hasStepFailed(step);
        let description = step.keyword;
        if (stepName) {
            description += stepName;
        }
        html += `<span class="${hasFailed ? 'scenario-status-failed' : 'scenario-status-passed'}">${description}</span>`;
        const isLastStep = stepIndex === steps.length - 1;
        if (hasFailed) {
            html += `</br><span class="step-error">${step.result.error_message}</span>`;
        }
        if (!isLastStep) {
            html += '</br>';
        }
    });
    html += '</div>';
    return html;
}

function generateHtml() {
    let html = `<html>${generateHtmlHead()}<body><table>`;
    Object.keys(featureMap)
        .forEach(featureId => {
            const featureEntry = featureMap[featureId];
            html += generateFeatureRow(featureEntry, reportIds);
            const scenarioMap = featureEntry.scenarioMap;
            Object.keys(scenarioMap)
                .forEach(scenarioId => {
                    const scenarioEntry = scenarioMap[scenarioId];
                    html += generateScenarioRow(scenarioEntry, reportIds);
                });
        });
    html += '</table></body>';
    return html;
}

function mergeJsonFiles(folderPath) {
    readdirSync(folderPath)
        .filter(filePath => filePath.endsWith('.json'))
        .forEach(filePath => {
            const joinedPath = path.join(folderPath, filePath);
            const reportId = path.basename(filePath, '.json');
            reportIds.push(reportId);
            const features = readFeaturesFromJsonFile(joinedPath);
            mergeFeatures(reportId, features);
        });
}

const resultsFolder = process.argv[2];
if (!resultsFolder) {
    throw new Error('No results folder specified');
}
const outputFile = process.argv[3];
if (!outputFile) {
    throw new Error('No output file specified');
}

mergeJsonFiles(resultsFolder);
const html = generateHtml(featureMap);
writeFileSync(outputFile, html);
