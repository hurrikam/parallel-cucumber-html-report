'use strict';

const { readdirSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

const reportIds = [];
const scenarioMap = {};

function readFeaturesFromJsonFile(path) {
    const featuresJson = readFileSync(path, { encoding: 'utf8' });
    return JSON.parse(featuresJson);
}

function mergeScenarios(reportId, features) {
    features.forEach(feature => {
        const featureId = feature.uri;
        feature.elements.forEach(scenario => {
            const scenarioId = `${featureId}+${scenario.id}+line:${scenario.line}`;
            let scenarioEntry = scenarioMap[scenarioId];
            if (!scenarioEntry) {
                scenarioEntry = scenarioMap[scenarioId] = {
                    featureId,
                    featureDescription: feature.description,
                    name: scenario.name,
                    runs: {}
                };
            }
            scenarioEntry.runs[reportId] = scenario;
        });
    });
}

function generateHtmlHead() {
    return `
        <head>
            <style>${readFileSync('./report.css', { encoding: 'utf8' })}</style>
            <style>${readFileSync('./tooltip.css', { encoding: 'utf8' })}</style>
        </head>
    `;
}

function generateFeatureRow(featureDescription, reportIds) {
    let html = `<tr class="feature-row"><td>${featureDescription}</td>`;
    reportIds.forEach(reportId => html += `<td>${reportId}</td>`);
    html += '</tr>'
    return html;
}

function generateScenarioRow(scenarioEntry, reportIds) {
    let html = `<tr class="scenario-row"><td>${scenarioEntry.name}</td>`
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

function generateHtml(scenarioMap) {
    let html = `<html>${generateHtmlHead()}<body><table>`;
    let lastFeatureId;
    const scenarioIds = Object.keys(scenarioMap);
    scenarioIds
        .forEach(scenarioId => {
            const scenarioEntry = scenarioMap[scenarioId];
            const featureId = scenarioEntry.featureId;
            const startFeatureGroup = featureId != lastFeatureId;
            if (startFeatureGroup) {
                html += generateFeatureRow(scenarioEntry.featureDescription, reportIds);
                lastFeatureId = featureId;
            }
            html += generateScenarioRow(scenarioEntry, reportIds);
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
            mergeScenarios(reportId, features);
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
const html = generateHtml(scenarioMap);
writeFileSync(outputFile, html);
