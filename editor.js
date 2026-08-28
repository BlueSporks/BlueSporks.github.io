const DATA_KEY = "transport-tycoon-data"
const collections = ["buildings", "miners", "recipes", "items", "resources", "belts"]
let sourceData = null
let activeCollection = collections[0]
let activeIndex = 0

function clone(value) {
    return JSON.parse(JSON.stringify(value))
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

export function resetData() {
    if (!confirm("Reset all local edits and reload the original data?")) return
    localStorage.removeItem(DATA_KEY)
    window.location.reload()
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
        if (!data || collections.some(collection => !Array.isArray(data[collection]))) {
            throw new Error("Saved data is missing one or more collections")
        }
        return data
    } catch (error) {
        console.warn("Ignoring invalid saved trucking data:", error)
        localStorage.removeItem(DATA_KEY)
        return null
    }
}

window.editor = { initEditor, getEditorData, exportData, resetData, newDataEntry, deleteDataEntry }
