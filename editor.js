const DATA_KEY = "transport-tycoon-data"
const collections = ["buildings", "miners", "recipes", "items", "resources", "belts"]
const collectionDescriptions = {
    buildings: "Buildings are processing locations. Edit their display name, category, power use, maximum count, map color, and map coordinates.",
    miners: "Miners are resource-producing locations. Edit their display name, resource category, base rate, power use, map color, and map coordinates.",
    recipes: "Recipes define production steps. Edit the name, category, processing time, ingredient and product JSON arrays, cost, and payout.",
    items: "Items are the materials moved through the planner. Edit the display name, tier, and weight used for cargo calculations.",
    resources: "Resources are starting materials gathered from the map. Edit the display name, category, and optional gathering cost.",
    belts: "Belts define trailer or conveyor capacity. Edit the display name and rate used when calculating cargo capacity."
}
let sourceData = null
let activeCollection = collections[0]
let activeIndex = 0

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function validateData(data) {
    if (!data || typeof data !== "object" || collections.some(collection => !Array.isArray(data[collection]))) {
        throw new Error("Imported data is missing one or more collections")
    }
    return data
}

function fieldLabel(key) {
    return key.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase())
}

function renderList() {
    const editor = d3.select("#editor")
    editor.select(".editor-list").remove()
    const list = editor.insert("aside", ":first-child").classed("editor-list", true)
    list.append("div").classed("editor-list-heading", true).html("<span>Data</span><button class='editor-new' onclick='handlers.newDataEntry()'>New</button>")
    const tabs = list.append("div").classed("editor-collections", true)
    tabs.selectAll("button").data(collections).join("button")
        .classed("selected", name => name === activeCollection)
        .text(name => `${fieldLabel(name)} (${(sourceData[name] || []).length})`)
        .on("click", name => {
            activeCollection = name
            activeIndex = 0
            renderEditor()
        })
    list.append("div").classed("editor-records", true)
        .selectAll("button").data(sourceData[activeCollection] || []).join("button")
        .classed("selected", (_, index) => index === activeIndex)
        .html(item => `<strong>${item.name || item.key_name || "Unnamed entry"}</strong><small>${item.key_name || ""}</small>`)
        .on("click", (item, index) => {
            activeIndex = index
            renderEditor()
        })
}

function renderForm() {
    const editor = d3.select("#editor")
    editor.select(".editor-form").remove()
    const entries = sourceData[activeCollection] || []
    const entry = entries[activeIndex]
    const form = editor.append("section").classed("editor-form", true)
    if (!entry) {
        form.append("div").classed("empty-state", true).text("Select an entry to edit.")
        return
    }
    form.append("div").classed("editor-form-heading", true).html(`<div><span class="eyebrow">${fieldLabel(activeCollection)}</span><h2>${entry.name || entry.key_name || "New entry"}</h2></div><button class="danger" onclick="handlers.deleteDataEntry()">Delete</button>`)
    const grid = form.append("div").classed("editor-fields", true)
    Object.keys(entry).forEach(key => {
        const value = entry[key]
        const field = grid.append("label").classed(value instanceof Array || typeof value === "object" ? "editor-field editor-field-wide" : "editor-field", true)
        field.append("span").text(fieldLabel(key))
        if (value instanceof Array || typeof value === "object") {
            field.append("textarea").attr("data-key", key).property("value", JSON.stringify(value, null, 2))
        } else {
            field.append("input").attr("data-key", key).attr("type", typeof value === "number" ? "number" : "text").property("value", value)
        }
    })
    form.append("button").classed("primary editor-save", true).text("Save changes").on("click", saveEntry)
    form.append("span").classed("editor-status", true).text("Edits are local to this browser.")
}

function renderEditor() {
    if (!sourceData) return
    d3.select("#editor-description").text(collectionDescriptions[activeCollection])
    renderList()
    renderForm()
}

function saveEntry() {
    const entry = sourceData[activeCollection][activeIndex]
    const fields = document.querySelectorAll("#editor .editor-form [data-key]")
    try {
        fields.forEach(field => {
            const key = field.dataset.key
            if (field.tagName === "TEXTAREA") {
                entry[key] = JSON.parse(field.value)
            } else if (field.type === "number") {
                entry[key] = Number(field.value)
            } else {
                entry[key] = field.value
            }
        })
    } catch (error) {
        log.add("error", `Could not save entry: ${error.message}`)
        return
    }
    localStorage.setItem(DATA_KEY, JSON.stringify(sourceData))
    log.add("info", `${fieldLabel(activeCollection)} saved`)
    window.location.reload()
}

export function newDataEntry() {
    const key = `new-${Date.now()}`
    const templates = {
        buildings: { key_name: key, name: "New building", category: "factory", power: 1, max: 1, color: 0, x: 0, y: 0 },
        miners: { key_name: key, name: "New miner", category: "resource", power: 1, base_rate: 1, color: 0, x: 0, y: 0 },
        recipes: { key_name: key, name: "New recipe", category: "factory", time: 1, ingredients: [], product: [], cost: 0, pays: 0 },
        items: { key_name: key, name: "New item", tier: 0, weight: 1 },
        resources: { key_name: key, name: "New resource", category: "resource", cost: 0 },
        belts: { key_name: key, name: "New belt", rate: 0 }
    }
    sourceData[activeCollection].push(templates[activeCollection])
    activeIndex = sourceData[activeCollection].length - 1
    renderEditor()
}

export function deleteDataEntry() {
    if (!confirm("Delete this entry? This cannot be undone unless you reset the data.")) return
    sourceData[activeCollection].splice(activeIndex, 1)
    activeIndex = Math.max(0, activeIndex - 1)
    localStorage.setItem(DATA_KEY, JSON.stringify(sourceData))
    window.location.reload()
}

export function exportData() {
    const blob = new Blob([JSON.stringify(sourceData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "transport-tycoon-data.json"
    link.click()
    URL.revokeObjectURL(url)
}

export function importData(event) {
    if (!event) {
        document.querySelector("#editor-import-input").click()
        return
    }
    const file = event.target.files[0]
    event.target.value = ""
    if (!file) return

    file.text().then(text => {
        let importedData
        try {
            importedData = validateData(JSON.parse(text))
        } catch (error) {
            log.add("error", `Could not import JSON: ${error.message}`)
            return
        }
        if (!confirm("Import this data and replace all current local edits?")) return
        localStorage.setItem(DATA_KEY, JSON.stringify(importedData))
        window.location.reload()
    }).catch(error => {
        log.add("error", `Could not read import file: ${error.message}`)
    })
}

export function resetData() {
    if (!confirm("Reset all local edits and reload the original data?")) return
    localStorage.removeItem(DATA_KEY)
    window.location.reload()
}

export function downloadTutorial() {
    const tutorial = `TRANSPORT TYCOON DATA EDITOR

What this editor does
The editor changes the local copy of the site's data. Changes are saved in this browser and are used by the planner after you reload the page. Use Export JSON to keep a backup before making large changes.

How to edit data
1. Open the Edit data tab.
2. Choose Buildings, Miners, Recipes, Items, Resources, or Belts.
3. Select an entry from the list.
4. Change its fields and click Save changes.
5. Reload the page to rebuild the planner with the saved data.
6. Use Import JSON to restore a previously exported data file.
7. Use Reset data to remove all local edits and return to the original data.

Editable collections
- Buildings: name, key name, category, power, maximum count, color, and map X/Y.
- Miners: name, key name, category, power, base rate, color, and map X/Y.
- Recipes: name, key name, category, time, ingredients, products, cost, and payout.
- Items: name, key name, tier, and weight.
- Resources: name, key name, category, and cost.
- Belts: name, key name, and rate.

Recipe JSON format
Ingredients and products are arrays of pairs: [["item-key", amount]].
Example: [["sand", 25], ["sawdust", 10]]
The item key must match an Item key name. Amounts, time, cost, payout, weight, rate, and power must be numbers.

Other site controls
- Planner: add target recipes and view the production graph.
- Items: review trips, ingredients, products, cost, revenue, and profit.
- Storage: refresh inventory, vehicles, and self-storage data when API access is configured.
- Settings: configure truck capacity, trailer, perks, API settings, storage, and refresh timers.
- Log: review changes and API activity.
- Export JSON: download a backup of the current local data.
- Import JSON: replace local data with a previously exported JSON file.

Safety tips
Export before editing. Keep key names stable when possible because recipes and ingredients reference them. If the planner stops loading after an edit, use Reset data or restore a known-good JSON backup.
`
    const blob = new Blob([tutorial], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "transport-tycoon-editor-tutorial.txt"
    link.click()
    URL.revokeObjectURL(url)
}

export function initEditor(data) {
    sourceData = clone(data)
    renderEditor()
}

export function getEditorData() {
    const saved = localStorage.getItem(DATA_KEY)
    if (!saved) return null
    try {
        const data = JSON.parse(saved)
        return validateData(data)
    } catch (error) {
        console.warn("Ignoring invalid saved trucking data:", error)
        localStorage.removeItem(DATA_KEY)
        return null
    }
}

window.editor = { initEditor, getEditorData, exportData, importData, resetData, newDataEntry, deleteDataEntry, downloadTutorial }
