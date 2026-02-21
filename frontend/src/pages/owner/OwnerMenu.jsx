// OwnerMenu.jsx (paste-ready)
// - "Edit Section" becomes "Rename Section" and opens the SAME modal
// - Removes the minus delete-mode behavior entirely
// - Keeps edit/delete item via kebab menu (already matches theme once CSS is updated)

import React, { useMemo, useState } from "react";

const CURRENCIES = ["USD", "LBP", "EUR"];

export default function OwnerMenu() {
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  // Item flow step: 1 = choose section, 2 = item details
  const [itemStep, setItemStep] = useState(1);

  // Add section
  const [newSectionName, setNewSectionName] = useState("");

  // Add item: choose section
  const [selectedSectionId, setSelectedSectionId] = useState("");

  // Add item: details
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCurrency, setItemCurrency] = useState("USD");
  const [itemDesc, setItemDesc] = useState("");
  const [itemImageFile, setItemImageFile] = useState(null);

  const [openSectionMenuId, setOpenSectionMenuId] = useState(null);

  // ✅ Edit/Rename section states
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  const [openItemMenuId, setOpenItemMenuId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [returnToItemAfterSection, setReturnToItemAfterSection] = useState(false);

  const itemImagePreviewUrl = useMemo(() => {
    if (!itemImageFile) return "";
    return URL.createObjectURL(itemImageFile);
  }, [itemImageFile]);

  function closeAllMenus() {
    setOpenSectionMenuId(null);
    setOpenItemMenuId(null);
  }

  function openAddSection() {
    // ensure we are in "add" mode
    setEditingSectionId(null);
    setEditingSectionName("");
    setNewSectionName("");
    setSectionModalOpen(true);
  }

  function closeAddSection() {
    setSectionModalOpen(false);
    setEditingSectionId(null);
    setEditingSectionName("");
  }

  function addSection(e) {
    e.preventDefault();

    const name = newSectionName.trim();
    if (!name) return;

    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setSections((prev) => [...prev, { id, name }]);

    setSectionModalOpen(false);

    // If we came from item flow, go back automatically
    if (returnToItemAfterSection) {
      setReturnToItemAfterSection(false);

      // Select the new section for the item
      setSelectedSectionId(id);

      // Reopen item modal at step 2 (item details)
      setItemStep(2);
      setItemModalOpen(true);
    }
  }

  // ✅ Rename/Save edited section
  function saveEditedSection(e) {
    e.preventDefault();

    const name = editingSectionName.trim();
    if (!name) return;

    setSections((prev) =>
      prev.map((s) => (s.id === editingSectionId ? { ...s, name } : s))
    );

    setEditingSectionId(null);
    setEditingSectionName("");
    setSectionModalOpen(false);
  }

  function deleteSection(sectionId) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setItems((prev) => prev.filter((it) => it.sectionId !== sectionId));
  }

  function deleteItem(itemId) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  function startEditItem(item) {
    setEditingItemId(item.id);

    setSelectedSectionId(item.sectionId);
    setItemName(item.name);
    setItemPrice(item.price);
    setItemCurrency(item.currency);
    setItemDesc(item.description);

    setItemModalOpen(true);
    setItemStep(2);
  }

  function openAddItem() {
    setEditingItemId(null);
    setItemStep(1);
    setSelectedSectionId("");
    setItemName("");
    setItemPrice("");
    setItemCurrency("USD");
    setItemDesc("");
    setItemImageFile(null);
    setItemModalOpen(true);
  }

  function closeAddItem() {
    setItemModalOpen(false);
  }

  function onPickItemImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const isImage = file.type && file.type.startsWith("image/");
    if (!isImage) {
      alert("Please select an image file (PNG, JPG, JPEG).");
      e.target.value = "";
      return;
    }

    setItemImageFile(file);
  }

  function goToItemDetails(e) {
    e.preventDefault();
    if (!selectedSectionId) return;
    setItemStep(2);
  }

  function saveItem(e) {
    e.preventDefault();

    if (!selectedSectionId) return;
    if (!itemName.trim()) return;
    if (!itemPrice.trim()) return;

    const payload = {
      sectionId: selectedSectionId,
      name: itemName.trim(),
      price: itemPrice.trim(),
      currency: itemCurrency,
      description: itemDesc.trim(),
      imagePreviewUrl: itemImagePreviewUrl || "",
    };

    // EDIT mode: update the existing item
    if (editingItemId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItemId
            ? {
                ...it,
                ...payload,
                // keep old image if you didn't pick a new one
                imagePreviewUrl:
                  payload.imagePreviewUrl || it.imagePreviewUrl || "",
              }
            : it
        )
      );

      setEditingItemId(null);
      setItemModalOpen(false);
      return;
    }

    // ADD mode: create a new item
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    setItems((prev) => [{ id, ...payload }, ...prev]);

    setItemModalOpen(false);
  }

  function openAddSectionFromItemFlow() {
    // 1) remember we want to go back to item after creating the section
    setReturnToItemAfterSection(true);

    // 2) close the item modal so the section modal is not hidden behind it
    setItemModalOpen(false);

    // 3) open section modal immediately (ADD MODE)
    setEditingSectionId(null);
    setEditingSectionName("");
    setNewSectionName("");
    setSectionModalOpen(true);
  }

  // ✅ Open rename section modal
  function openRenameSection(section) {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
    setSectionModalOpen(true);
  }

  // (kept; not required, but harmless)
  const sectionNameById = useMemo(() => {
    const map = new Map();
    sections.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sections]);

  return (
    <div className="ownerMenuPage" onClick={closeAllMenus}>
      <h1 className="ownerMenuPage__title">Edit Your Menu Smoothly</h1>

      <div className="ownerMenuPage__actions">
        <button
          className="btn btn--ghost ownerMenuPage__actionBtn"
          type="button"
          onClick={openAddSection}
        >
          Add Section
        </button>
        <button
          className="btn btn--gold ownerMenuPage__actionBtn"
          type="button"
          onClick={openAddItem}
        >
          Add Item
        </button>
      </div>

      <div className="ownerMenuSectionsStack">
        {sections.map((s) => {
          const sectionItems = items.filter((it) => it.sectionId === s.id);

          return (
            <div className="menuSectionBlock" key={s.id}>
              <div className="menuSectionHeader">
                <button className="btn btn--gold ownerMenuSectionBtn">
                  {s.name}
                </button>

                <div className="kebabWrap">
                  <button
                    className="kebabBtn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSectionMenuId((prev) =>
                        prev === s.id ? null : s.id
                      );
                    }}
                  >
                    ⋯
                  </button>

                  {openSectionMenuId === s.id && (
                    <div
                      className="kebabMenu"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="kebabItem"
                        type="button"
                        onClick={() => {
                          openRenameSection(s);
                          setOpenSectionMenuId(null);
                        }}
                      >
                        Rename Section
                      </button>

                      <button
                        className="kebabItem kebabItem--danger"
                        type="button"
                        onClick={() => {
                          deleteSection(s.id);
                          setOpenSectionMenuId(null);
                        }}
                      >
                        Delete Section
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {sectionItems.length > 0 ? (
                <div className="ownerMenuItemsGrid">
                  {sectionItems.map((it) => (
                    <div className="menuItemCard" key={it.id}>
                      <div className="kebabWrap kebabWrap--item">
                        <button
                          className="kebabBtn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenItemMenuId((prev) =>
                              prev === it.id ? null : it.id
                            );
                          }}
                        >
                          ⋯
                        </button>

                        {openItemMenuId === it.id && (
                          <div
                            className="kebabMenu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="kebabItem"
                              type="button"
                              onClick={() => {
                                startEditItem(it);
                                setOpenItemMenuId(null);
                              }}
                            >
                              Edit item
                            </button>

                            <button
                              className="kebabItem kebabItem--danger"
                              type="button"
                              onClick={() => {
                                deleteItem(it.id);
                                setOpenItemMenuId(null);
                              }}
                            >
                              Delete item
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ❌ removed the old minus-delete-mode button */}

                      <div className="menuItemCard__media">
                        {it.imagePreviewUrl ? (
                          <img
                            className="menuItemCard__img"
                            src={it.imagePreviewUrl}
                            alt={it.name}
                          />
                        ) : (
                          <div className="menuItemCard__imgPlaceholder">
                            PNG, JPG, or JPEG
                          </div>
                        )}
                      </div>

                      <div className="menuItemCard__info">
                        <div className="menuItemCard__name">{it.name}</div>
                        <div className="menuItemCard__price">
                          {it.price} {it.currency}
                        </div>
                        {it.description && (
                          <div className="menuItemCard__desc">
                            {it.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="menuSectionEmpty">No items in this section yet.</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Rename Section Modal */}
      {sectionModalOpen && (
        <div className="modal is-open" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={closeAddSection} />
          <div className="modal__panel" role="document">
            <button
              className="modal__close"
              type="button"
              onClick={closeAddSection}
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="modal__title">
              {editingSectionId ? "Rename Section" : "Add Section"}
            </h2>
            <p className="modal__subtitle">
              {editingSectionId
                ? "Update the section name."
                : "Create a new menu section (e.g., Starters, Drinks)."}
            </p>

            <form
              className="form"
              onSubmit={editingSectionId ? saveEditedSection : addSection}
            >
              <label className="field">
                <span>Section name</span>
                <input
                  type="text"
                  placeholder="Enter section name"
                  value={editingSectionId ? editingSectionName : newSectionName}
                  onChange={(e) =>
                    editingSectionId
                      ? setEditingSectionName(e.target.value)
                      : setNewSectionName(e.target.value)
                  }
                  required
                />
              </label>

              <button className="btn btn--gold btn--xl" type="submit">
                {editingSectionId ? "Update" : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {itemModalOpen && (
        <div className="modal is-open" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={closeAddItem} />
          <div className="modal__panel" role="document">
            <button
              className="modal__close"
              type="button"
              onClick={closeAddItem}
              aria-label="Close"
            >
              ✕
            </button>

            {itemStep === 1 ? (
              <>
                <h2 className="modal__title">Add Item</h2>
                <p className="modal__subtitle">
                  Choose the section where this item belongs.
                </p>

                <form className="form" onSubmit={goToItemDetails}>
                  <label className="field">
                    <span>Section</span>
                    <select
                      className="select"
                      value={selectedSectionId}
                      onChange={(e) => setSelectedSectionId(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select a section
                      </option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="menuModalHelper">
                    <div className="menuModalHelper__text">
                      Section Not There Yet?
                    </div>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={openAddSectionFromItemFlow}
                    >
                      Add Section
                    </button>
                  </div>

                  <button
                    className="btn btn--gold btn--xl"
                    type="submit"
                    disabled={!sections.length}
                  >
                    Next
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="modal__title">Item Details</h2>
                <p className="modal__subtitle">
                  Fill the information and add an optional image.
                </p>

                <form className="form" onSubmit={saveItem}>
                  <label className="field">
                    <span>Item name</span>
                    <input
                      type="text"
                      placeholder="Enter item name"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                    />
                  </label>

                  <div className="twoCols">
                    <label className="field">
                      <span>Item price</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Enter price"
                        value={itemPrice}
                        onChange={(e) => setItemPrice(e.target.value)}
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Currency</span>
                      <select
                        className="select"
                        value={itemCurrency}
                        onChange={(e) => setItemCurrency(e.target.value)}
                        required
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    <span>Description</span>
                    <input
                      type="text"
                      placeholder="Enter description"
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                    />
                  </label>

                  <div className="imageCard imageCard--equal menuItemImageCard">
                    <div className="imageCard__title">Item image</div>

                    <div className="imageCard__preview imageCard__preview--equal">
                      {itemImagePreviewUrl ? (
                        <img
                          className="imageCard__img"
                          src={itemImagePreviewUrl}
                          alt="Item"
                        />
                      ) : (
                        <div className="imageCard__placeholder">
                          <div className="imageCard__formats">
                            PNG, JPG, or JPEG
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="btn btn--gold imageCard__btn">
                      Upload image
                      <input
                        className="imageCard__input"
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={onPickItemImage}
                      />
                    </label>
                  </div>

                  <div className="menuModalActions">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => setItemStep(1)}
                    >
                      Back
                    </button>

                    <button className="btn btn--gold btn--xl" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}