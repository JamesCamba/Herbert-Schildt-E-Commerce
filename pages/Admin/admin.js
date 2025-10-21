(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const SECTIONS = {
    dashboard: $('#dashboard'),
    books: $('#books'),
    users: $('#users')
  };

  /*** Section Switching ***/
  function switchSection(target) {
    Object.values(SECTIONS).forEach(section => section.classList.remove('visible'));
    SECTIONS[target].classList.add('visible');
    $$('.menu-item').forEach(btn => btn.classList.toggle('active', btn.dataset.target === target));
  }

  /*** BOOKS ***/
  async function fetchBooks() {
    try {
      const res = await fetch("http://127.0.0.1:5000/get-books");
      if (!res.ok) throw new Error("Failed to fetch books");
      return await res.json();
    } catch (err) {
      console.error("Error fetching books:", err);
      return [];
    }
  }




  const API_BASE = "http://127.0.0.1:5000"; // Flask backend

  function renderBooks(books) {
    const tbody = document.getElementById("books-tbody");
    tbody.innerHTML = (books || []).map(book => `
    <tr>
      <td>${book.title}</td>
      <td>${book.category}</td>
      <td>$${Number(book.price).toFixed(2)}</td>
      <td>${book.type || (book.pdf ? "PDF" : "PHYSICAL")}</td>
      <td><button data-action="edit" data-id="${book.id}">EDIT</button></td>
      <td><button data-action="delete" data-id="${book.id}">DELETE</button></td>
    </tr>
  `).join("");
  }

  // Global event listener
  document.addEventListener("click", async (e) => {
    const action = e.target.dataset.action;
    const bookId = e.target.dataset.id;

    if (!action || !bookId) return;

    if (action === "edit") {
      const res = await fetch(`${API_BASE}/get-books`);
      const books = await res.json();
      const book = books.find(b => b.id == bookId);

      if (book) {
        openEditModal(book);
        const modal = document.getElementById("edit-book-modal");
        modal.dataset.bookId = book.id; // save for update
      }
    }

    if (action === "delete") {
      if (confirm("Are you sure you want to delete this book?")) {
        await fetch(`${API_BASE}/delete-book/${bookId}`, { method: "DELETE" });
        const res = await fetch(`${API_BASE}/get-books`);
        const books = await res.json();
        renderBooks(books);
      }
    }
  });


  // document.getElementById("edit-book-cover").addEventListener("change", (e) => {
  //   const file = e.target.files[0];
  //   if (!file) return;

  //   // Preview selected image
  //   const reader = new FileReader();
  //   reader.onload = () => {
  //     const imgCover = document.querySelector(".edit-img-cover");
  //     imgCover.style.backgroundImage = `url(${reader.result})`;
  //     imgCover.style.backgroundSize = "cover";
  //     imgCover.style.backgroundPosition = "center";
  //   };
  //   reader.readAsDataURL(file);

  //   // TODO: send to backend (same upload-image route)
  // });




  function openEditModal(book) {
    // Show modal
    const modal = document.getElementById("edit-book-modal");
    modal.setAttribute("aria-hidden", "false");
    modal.dataset.bookId = book.id; // ensure bookId is stored

    // Fill inputs
    document.getElementById("edit-book-title").value = book.title || "";
    document.getElementById("edit-book-description").value = book.description || "";
    document.getElementById("edit-book-price").value = book.price || "";
    document.getElementById("edit-book-category").value = book.category || "";

    // Rating
    const ratingSelect = document.getElementById("edit-rating");
    const rating = parseFloat(book.rating) || 3.0;
    const optionToSelect = Array.from(ratingSelect.options).find(opt => parseFloat(opt.value) === rating);
    if (optionToSelect) optionToSelect.selected = true;

    document.getElementById("edit-book-year").value = book.year || "";
    document.getElementById("edit-book-pages").value = book.pages || "";
    document.getElementById("edit-book-isbn").value = book.isbn || "";

    // Book type toggle
    const bookTypeSelect = document.getElementById("edit-book-type");
    const pdfSection = document.getElementById("edit-bookpdf");
    const physicalSection = document.querySelector(".edit-physical-link");
    const pdfFileName = document.getElementById("edit-pdf-file-name");
    const webLinkInput = document.getElementById("edit-web-link");

    if (book.pdf) {
      bookTypeSelect.value = "PDF";
      pdfSection.style.display = "block";
      physicalSection.style.display = "none";
      pdfFileName.innerText = book.pdf;
      pdfFileName.style.display = "block";
      webLinkInput.value = "";
      book.amazon = null;
    } else {
      bookTypeSelect.value = "PHYSICAL";
      pdfSection.style.display = "none";
      physicalSection.style.display = "block";
      webLinkInput.value = book.amazon || book.goodsread || "";
      pdfFileName.style.display = "none";
      book.pdf = null;
    }

    bookTypeSelect.addEventListener("change", function () {
      if (this.value === "PDF") {
        pdfSection.style.display = "block";
        physicalSection.style.display = "none";
        pdfFileName.style.display = "block";
        webLinkInput.value = "";
        book.pdf = book.pdf || "";
        book.amazon = null;
      } else {
        pdfSection.style.display = "none";
        physicalSection.style.display = "block";
        pdfFileName.style.display = "none";
        book.pdf = null;
      }
    });

    // Cover image preview
    const imgCover = document.querySelector(".edit-img-cover");
    const fileInput = document.getElementById("edit-book-cover");

    if (book.image) {
      imgCover.style.backgroundImage = `url(${encodeURI(`../../${book.image}`)})`;
      imgCover.style.backgroundSize = "cover";
      imgCover.style.backgroundPosition = "center";
    } else {
      imgCover.style.backgroundImage = "none";
    }

    fileInput.onchange = function () {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          imgCover.style.backgroundImage = `url(${e.target.result})`;
          imgCover.style.backgroundSize = "cover";
          imgCover.style.backgroundPosition = "center";
        };
        reader.readAsDataURL(file);

        // Save relative path
        book.image = `img/books/${file.name}`;
      }
    };

    const API_BASE = "http://127.0.0.1:5000";
    // Update book handler
    document.getElementById("edit-book-submit").onclick = async () => {
      const bookId = modal.dataset.bookId;

      const webLink = document.getElementById("edit-web-link").value.trim();
      const pdfFileNameEl = document.getElementById("edit-pdf-file-name");
      let pdfFileName = pdfFileNameEl.innerText.trim();
      // remove any folder part
      pdfFileName = pdfFileName.replace(/^.*[\\/]/, "");
      // remove leading 'books-pdf_' if present
      pdfFileName = pdfFileName.replace(/^books-pdf_/, "");


      const bookType = document.getElementById("edit-book-type").value;

      if (bookType === "PHYSICAL" && !webLink) {
        alert("Please enter the website link for the physical book!");
      }

      // ✅ Validate input: must have either PDF or web link


      if (bookType === "PHYSICAL" && !webLink) {
        alert("Please enter the website link for the physical book!");
        return; // prevent submit
      }


      const updatedBook = {
        title: document.getElementById("edit-book-title").value,
        author: "Unknown",
        description: document.getElementById("edit-book-description").value,
        price: document.getElementById("edit-book-price").value || "",
        category: document.getElementById("edit-book-category").value,
        rating: parseFloat(document.getElementById("edit-rating").value) || "",
        year: document.getElementById("edit-book-year").value || "",
        pages: document.getElementById("edit-book-pages").value || "",
        isbn: document.getElementById("edit-book-isbn").value,
        pdf: webLink ? "" : pdfFileName, // never null
        image: book.image || "",
        goodsread: webLink || "",        // never null
        amazon: webLink || "",           // never null
        noStock: document.getElementById("edit-book-stock")?.checked || false
      };

      try {
        // 1️⃣ Update DB record
        const response = await fetch(`http://127.0.0.1:5000/update-book/${bookId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedBook)
        });




        if (!response.ok) {
          const err = await response.json();
          alert("Failed to update book: " + err.error);
          return;
        }

        // 2️⃣ Upload cover if new file selected
        const coverFile = document.getElementById("edit-book-cover").files[0];
        if (coverFile) {
          const formData = new FormData();
          formData.append("file", coverFile);
          const uploadRes = await fetch(`http://127.0.0.1:5000/upload-cover/${bookId}`, {
            method: "POST",
            body: formData,
          });
          const uploadResp = await uploadRes.json();
          if (uploadResp.success) alert("✅ Cover updated!");
        }

        // 3️⃣ Refresh list
        const res = await fetch(`${API_BASE}/get-books`);
        renderBooks(await res.json());

        modal.setAttribute("aria-hidden", "true");

      } catch (error) {
        console.error("Error updating book:", error);
        alert("Error updating book: " + error.message);
      }
    };


    document.getElementById("edit-book-pdf").addEventListener("change", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.target.files[0];
      if (!file) return;

      const modal = document.getElementById("edit-book-modal");
      if (!modal) return;

      const bookId = modal.dataset.bookId;
      if (!bookId) return;

      // ✅ First, strip any fake path (C:\fakepath\...)
      let baseName = file.name.replace(/^.*[\\/]/, "");
      // ✅ Then remove any leading 'books-pdf_' prefix
      let cleanName = baseName.replace(/^books-pdf_/, "");

      console.log("📤 Sending file to backend with name:", cleanName);

      const cleanFile = new File([file], cleanName, { type: file.type });

      const formData = new FormData();
      formData.append("file", cleanFile);

      // Optional: log all FormData entries
      for (let pair of formData.entries()) {
        console.log("FormData entry:", pair[0], pair[1].name);
      }

      try {
        const res = await fetch(`http://127.0.0.1:5000/upload-pdf/${bookId}`, {
          method: "POST",
          body: formData,
        });

        const respText = await res.text();
        let resp;
        try {
          resp = JSON.parse(respText);
        } catch (parseErr) {
          showMessage("❌ JSON parse failed: " + parseErr.message, "error");
          return;
        }

        if (resp.success) {
          const pdfNameEl = document.getElementById("edit-pdf-file-name");
          pdfNameEl.innerText = resp.path.replace(/\\/g, "/");
          pdfNameEl.style.display = "block";
          showMessage("✅ PDF changed successfully", "success");
        } else {
          showMessage("❌ Upload failed: " + resp.message, "error");
        }

        // Prevent form submission/refresh
        if (e.target.form) {
          e.target.form.addEventListener("submit", (evt) => evt.preventDefault());
        }
      } catch (err) {
        showMessage("💥 Error uploading PDF: " + err.message, "error");
      }
    });

    // ✅ Simple message function
    function showMessage(msg, type = "info") {
      let container = document.getElementById("upload-message");
      if (!container) {
        container = document.createElement("div");
        container.id = "upload-message";
        container.style.position = "fixed";
        container.style.top = "10px";
        container.style.right = "10px";
        container.style.padding = "10px 15px";
        container.style.borderRadius = "5px";
        container.style.zIndex = "9999";
        container.style.fontFamily = "sans-serif";
        container.style.transition = "opacity 0.5s";
        container.style.opacity = "0";
        document.body.appendChild(container);
      }

      container.innerText = msg;
      container.style.backgroundColor =
        type === "success" ? "#4caf50" :
          type === "error" ? "#f44336" :
            "#2196f3";
      container.style.color = "#fff";
      container.style.opacity = "1";

      // Hide after 3 seconds with fade
      setTimeout(() => {
        container.style.opacity = "0";
        setTimeout(() => {
          container.innerText = "";
        }, 500); // match fade duration
      }, 3000);
    }

  }


  const editForm = document.getElementById("edit-book-form");
  editForm.addEventListener("submit", (e) => {
    e.preventDefault(); // stops any accidental form submission
  });




  // Close modal handlers
  document.getElementById("edit-book-modal-close").addEventListener("click", () => {
    document.getElementById("edit-book-modal").setAttribute("aria-hidden", "true");
  });
  document.getElementById("edit-book-cancel").addEventListener("click", () => {
    document.getElementById("edit-book-modal").setAttribute("aria-hidden", "true");
  });


  // Listen for clicks on the tbody


  function setupDeleteBooks() {
    const tbody = document.getElementById('books-tbody');

    // Use event delegation so dynamically added rows also work
    tbody.addEventListener('click', async function (e) {
      const btn = e.target.closest('button[data-action="delete"]');
      if (!btn) return;

      const bookId = btn.getAttribute('data-id');
      if (!bookId) return;

      if (!confirm("Are you sure you want to delete this book?")) return;

      try {
        const res = await fetch(`http://127.0.0.1:5000/delete-book/${bookId}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          alert("Book deleted successfully!");
          // Remove row from table without refresh
          btn.closest('tr').remove();
        } else {
          const data = await res.json();
          alert("Failed to delete book: " + (data.error || 'Unknown error'));
        }
      } catch (err) {
        console.error("Error deleting book:", err);
        alert("Request error. Check console for details.");
      }
    });
  }

  // Call this function after rendering books
  setupDeleteBooks();


  function openBookModal(book = null) {
    const modal = $('#book-modal');
    const form = $('#book-form');
    const titleEl = $('#book-modal-title');
    const submitBtn = $('#book-submit');
    const typeSel = $('#book-type');

    form.reset();
    form.dataset.editId = book?.id || '';

    if (book) {
      titleEl.textContent = 'Edit Book';
      submitBtn.textContent = 'Save Changes';
      $('#book-title').value = book.title;
      $('#book-price').value = book.price;
      $('#book-category').value = book.category;
      typeSel.value = book.type || (book.pdf ? 'PDF' : 'PHYSICAL');
    } else {
      titleEl.textContent = 'Add New Book';
      submitBtn.textContent = 'Add New Book';
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeBookModal() {
    const modal = $('#book-modal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  /*** USERS ***/
  async function fetchUsers() {
    try {
      const res = await fetch("http://127.0.0.1:5000/get-users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    } catch (err) {
      console.error("Error fetching users:", err);
      return [];
    }
  }

  function renderUsers(users = []) {
    const tbody = document.getElementById('users-tbody');

    if (!users.length) {
      tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:1rem;">No users found</td>
      </tr>
    `;
      return;
    }

    tbody.innerHTML = users.map((user, index) => {
      const paidBooks = user.Paid_Book && user.Paid_Book.trim()
        ? ((user.Paid_Book.length > 20) ? user.Paid_Book.slice(0, 20) + '…' : user.Paid_Book)
        : 'No paid book';

      return `
      <tr>
        <td>${user.FullName || ''}</td>
        <td>${(user.Email || '').length > 25 ? (user.Email.slice(0, 15) + '…') : user.Email}</td>
        <td>${paidBooks}</td>
        <td>${user.Date_Joined || ''}</td>
        <td><button class="view-btn" data-index="${index}">View</button></td>
      </tr>
    `;
    }).join('');

    // Reattach click events
    tbody.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => openUserModal(users[btn.dataset.index]));
    });
  }


  async function openUserModal(user) {
    if (!user) return;

    // Fill user info
    document.getElementById('u-fullname').textContent = user.FullName || '';
    document.getElementById('u-email').textContent = user.Email || '';
    document.getElementById('u-joined').textContent = user.Date_Joined || '';

    // Books
    const books = (user.Paid_Book || '').toString().trim();
    document.getElementById('u-books').innerHTML = books
      ? books.split(',').map(b => `<span class="chip">${b.trim()}</span>`).join('')
      : 'No books paid';

    // Show modal
    const modal = document.getElementById('user-modal');
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    // Assign user ID to buttons
    const blockBtn = document.getElementById('user-block');
    const unblockBtn = document.getElementById('user-unblock');
    const deleteBtn = document.getElementById('user-delete');

    blockBtn.dataset.userId = user.UserID;
    unblockBtn.dataset.userId = user.UserID;
    deleteBtn.dataset.userId = user.UserID;

    // Check block status from backend
    try {
      const response = await fetch(`http://127.0.0.1:5000/check-block/${user.UserID}`);
      const data = await response.json();

      if (data.blocked) {
        blockBtn.style.display = 'none';
        unblockBtn.style.display = 'inline-block';
      } else {
        blockBtn.style.display = 'inline-block';
        unblockBtn.style.display = 'none';
      }
    } catch (err) {
      console.error('Error checking block status:', err);
      blockBtn.style.display = 'inline-block';
      unblockBtn.style.display = 'none';
    }

    // Attach block click
    blockBtn.onclick = function () {
      const userId = this.dataset.userId;
      // const days = prompt('Enter number of days to block this user:', 1);
      // if (!days) return;

      fetch(`http://127.0.0.1:5000/block-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(days, 10) })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('User has been blocked.');
            blockBtn.style.display = 'none';
            unblockBtn.style.display = 'inline-block';
          } else {
            alert('Failed to block user.');
          }
        })
        .catch(err => {
          console.error(err);
          alert('An error occurred while blocking.');
        });
    };

    // Attach unblock click
    unblockBtn.onclick = function () {
      const userId = this.dataset.userId;
      if (!userId) return;

      const confirmUnblock = confirm('Are you sure you want to unblock this user?');
      if (!confirmUnblock) return;

      fetch(`http://127.0.0.1:5000/unblock-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('User has been unblocked.');
            unblockBtn.style.display = 'none';
            blockBtn.style.display = 'inline-block';
          } else {
            alert('Failed to unblock user.');
          }
        })
        .catch(err => {
          console.error(err);
          alert('An error occurred while unblocking.');
        });
    };

    // Attach delete click event
    // Attach delete click event
    deleteBtn.onclick = async function () {
      const userId = this.dataset.userId;
      if (!userId) return;

      const confirmDelete = confirm('Are you sure you want to delete this user? This action cannot be undone.');
      if (!confirmDelete) return;

      try {
        const response = await fetch(`http://127.0.0.1:5000/delete-user/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (data.success) {
          alert('User has been deleted.');
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');

          // ✅ Fetch updated users and re-render
          const usersResponse = await fetch('http://127.0.0.1:5000/get-users');
          const updatedUsers = await usersResponse.json();
          renderUsers(updatedUsers);

        } else {
          alert(`Failed to delete user: ${data.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        alert('An error occurred while deleting the user.');
      }
    };

  }




  const blockBtn = document.getElementById('user-block');

  blockBtn.addEventListener('click', () => {
    // Get the currently viewed user’s info
    const userName = document.getElementById('u-fullname').textContent;
    const userId = blockBtn.dataset.userId; // You need to set this dynamically when opening user modal

    openBlockUserModal(userName, userId);
  });



  // Close modal
  $('#user-modal-close').addEventListener('click', () => {
    const modal = $('#user-modal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  });
  function closeUserModal() {
    $('#user-modal').classList.remove('show');
    $('#user-modal').setAttribute('aria-hidden', 'true');
  }

  /*** DASHBOARD REFRESH ***/
  async function refreshDashboard() {
    const books = await fetchBooks();
    const users = await fetchUsers();

    // Total books
    $('#stat-total-books').textContent = books.length;

    // Total PDFs
    const pdfCount = books.filter(b => b.pdf).length;
    $('#stat-pdf').textContent = pdfCount;

    // Total physical books (goodsread + amazon)
    const physicalCount = books.filter(b => b.goodsread || b.amazon).length;
    $('#stat-physical').textContent = physicalCount;

    // Total books paid by users
    const totalPaidBooks = users.reduce((sum, u) => {
      const paid = u.Paid_Book ? u.Paid_Book.split(',').length : 0;
      return sum + paid;
    }, 0);
    $('#stat-orders').textContent = totalPaidBooks;

    // Render tables
    renderBooks(books);
    renderUsers(users);
  }



  // Open Block User Modal
  function openBlockUserModal(userName, userId) {
    const modal = document.querySelector('.blck-user-modal');
    const closeBtn = modal.querySelector('.blck-close-btn');
    const confirmBtn = modal.querySelector('.blck-confirm-btn');
    const daysInput = modal.querySelector('.blck-days');

    // Reset input
    daysInput.value = 1;

    // Show modal
    modal.style.display = 'flex';

    // Remove any previous listeners to prevent duplicates
    closeBtn.onclick = null;
    confirmBtn.onclick = null;

    // Close modal on X
    closeBtn.onclick = () => {
      modal.style.display = 'none';
    };

    // Close modal if click outside content
    window.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    };

    // Confirm block button
    confirmBtn.onclick = (event) => {
      event.preventDefault();
      const days = parseInt(daysInput.value, 10);
      if (isNaN(days) || days < 1) {
        showError('Please enter a valid number of days.');
        return;
      }

      const confirmBlock = confirm(`Are you sure you want to block ${userName} for ${days} day(s)?`);
      if (!confirmBlock) return;

      fetch(`http://127.0.0.1:5000/block-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      })
        .then(res => res.text()) // get raw text first
        .then(text => {
          let data;
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = {};
          }

          if (data.success) {
            showSuccess(`${userName} has been blocked for ${days} day(s).`);
          } else {
            showError(data.message || 'Failed to block user.');
          }
        })
        .catch(err => {
          console.error(err);
          showError('An error occurred while blocking user.');
        })
        .finally(() => {
          // ✅ Always close modal after attempt
          modal.style.display = 'none';
        });
    };
  }



  // Attach click event to all delete buttons dynamically
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = btn.dataset.userId;
      const userName = btn.dataset.userName;
      deleteUser(userId, userName);
    });
  });




  /*** TABLE CLICK HANDLERS ***/
  function onBooksTableClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    // handle edit/delete externally if needed
  }

  function onUsersTableClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    // handle view externally if needed
  }

  /*** NAVIGATION + SIDEBAR ***/
  function setupNav() {
    $$('.menu-item').forEach(btn => btn.addEventListener('click', () => switchSection(btn.dataset.target)));
    $('#btn-open-add-book').addEventListener('click', () => openBookModal());
    $('#books-tbody').addEventListener('click', onBooksTableClick);
    $('#users-tbody').addEventListener('click', onUsersTableClick);
    $('#book-modal-close').addEventListener('click', closeBookModal);
    $('#book-cancel').addEventListener('click', closeBookModal);
    $('#user-modal-close').addEventListener('click', closeUserModal);
    $('#burger').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
  }

  /*** INIT INTERFACE ***/
  setupNav();
  refreshDashboard();
})();


// Show password functionality
document.getElementById('showPassword').addEventListener('change', function () {
  const passwordInput = document.getElementById('password');
  passwordInput.type = this.checked ? 'text' : 'password';
});

// Modal functions
function openBackupModal() {
  document.getElementById('backupModal').classList.add('active');
}

function closeBackupModal() {
  document.getElementById('backupModal').classList.remove('active');
  // Reset checkboxes
  document.querySelectorAll('#backupModal input[type="checkbox"]').forEach(cb => cb.checked = false);
}

let backupController = null;


async function performBackup() {
  const usersCheckbox = document.getElementById('sts-users');
  const booksCheckbox = document.getElementById('sts-books');

  if (!usersCheckbox.checked && !booksCheckbox.checked) {
    alert('Please select at least one backup option.');
    return;
  }

  // Create modal dynamically
  let modal = document.createElement("div");
  Object.assign(modal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "1000"
  });

  let content = document.createElement("div");
  Object.assign(content.style, {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    textAlign: "center",
    width: "300px"
  });

  let statusText = document.createElement("p");
  statusText.textContent = "Starting backup...";
  content.appendChild(statusText);

  let cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.marginTop = "10px";
  content.appendChild(cancelBtn);

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Setup abort controller
  backupController = new AbortController();
  const signal = backupController.signal;

  cancelBtn.onclick = () => {
    if (backupController) {
      backupController.abort();
      statusText.textContent = "Backup cancelled by user.";
      console.log("🛑 Backup aborted by user.");
    }
  };

  // Prepare query parameters
  let params = new URLSearchParams();
  if (usersCheckbox.checked) params.append("users", "1");
  if (booksCheckbox.checked) params.append("books", "1");

  try {
    console.log("🚀 Starting backup fetch...");
    statusText.textContent = "Connecting to server...";

    const res = await fetch(`http://127.0.0.1:5000/backup?${params.toString()}`, {
      method: "GET",
      signal: signal
    });

    console.log("📡 Response received from server.");

    if (!res.ok) {
      console.error("❌ Backup request failed with status:", res.status);
      throw new Error("Backup failed.");
    }

    statusText.textContent = "Downloading backup file...";
    console.log("💾 Downloading backup blob...");

    const blob = await res.blob();
    console.log("✅ Blob downloaded. Creating download link...");

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "backup.zip"; // default name
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log("📦 Backup download triggered in browser.");
    statusText.textContent = "Backup downloaded successfully!";

  } catch (err) {
    if (err.name === "AbortError") {
      statusText.textContent = "Backup cancelled by user.";
      console.log("⚠️ Fetch aborted by user.");
    } else {
      statusText.textContent = "Backup failed: " + err.message;
      console.error("❌ Backup error:", err);
    }
  } finally {
    // Remove modal and reset checkboxes after 2 seconds
    console.log("🧹 Cleaning up...");
    setTimeout(() => {
      modal.remove();
      usersCheckbox.checked = false;
      booksCheckbox.checked = false;
      console.log("✅ Modal closed and checkboxes reset.");
    }, 2000);
  }
}



// Close modal when clicking outside
document.getElementById('backupModal').addEventListener('click', function (e) {
  if (e.target === this) {
    closeBackupModal();
  }
});

// Handle "All Databases" checkbox logic
document.getElementById('all').addEventListener('change', function () {
  const usersCheckbox = document.getElementById('sts-users');
  const booksCheckbox = document.getElementById('sts-books');

  if (this.checked) {
    usersCheckbox.checked = true;
    booksCheckbox.checked = true;
  }
  else {
    usersCheckbox.checked = false;
    booksCheckbox.checked = false;
  }
});

// Uncheck "All" if individual items are unchecked
document.getElementById('sts-users').addEventListener('change', function () {
  if (!this.checked) {
    document.getElementById('all').checked = false;
  }
});

document.getElementById('sts-books').addEventListener('change', function () {
  if (!this.checked) {
    document.getElementById('all').checked = false;
  }
});