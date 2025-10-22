from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pyodbc
from werkzeug.utils import secure_filename
import json
import os
import io
import zipfile
from io import BytesIO
from datetime import datetime, timedelta
from urllib.parse import quote
import traceback
import sys
sys.stdout.reconfigure(encoding='utf-8')
from flask import Flask, send_from_directory
from flask import jsonify
import psycopg2

BOOKS_JSON_PATH = os.path.join(os.getcwd(), "all-books.json")
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)  # ✅ Enable CORS for all routes

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)


# Database connection function (reusable)
UPLOAD_COVERS = "img/books"
UPLOAD_PDFS = "books-pdf"
BACKUP_FOLDER = "backups"  # Folder to store backups

os.makedirs(BACKUP_FOLDER, exist_ok=True)
os.makedirs(UPLOAD_PDFS, exist_ok=True)
os.makedirs(UPLOAD_COVERS, exist_ok=True)


def get_db_connection():
    return psycopg2.connect(
        os.getenv(
            "DATABASE_URL",
            "postgresql://neondb_owner:npg_1MeBTYFx9XPN@ep-young-dawn-a1pvepi1-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        )
    )


@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT "UserID", "Email", "Password", "FullName", "Blocked"
        FROM "Users"
        WHERE "Email" = %s AND "Password" = %s
    """, (email, password))

    user = cursor.fetchone()
    conn.close()

    if user:
        blocked_until = user[4]
        if blocked_until:
            now = datetime.now()
            if blocked_until > now:
                remaining_days = (blocked_until - now).days
                return jsonify({
                    "success": False,
                    "blocked": True,
                    "blockedDays": remaining_days,
                    "message": f"Account is blocked for {remaining_days} more days"
                }), 200

        return jsonify({
            "success": True,
            "userId": user[0],
            "email": user[1],
            "fullName": user[3]
        }), 200

    return jsonify({"success": False, "message": "Invalid email or password"}), 401

# @app.route("/test-add-book")
# def test_add_book():
#     conn = get_db_connection()
#     cursor = conn.cursor()
#     try:
#         cursor.execute("INSERT INTO Books (title) VALUES (?)", ("Test Book",))
#         conn.commit()
#         return "✅ Insert successful"
#     except Exception as e:
#         return f"❌ Insert failed: {e}"
#     finally:
#         conn.close()

@app.route('/get-paid-books', methods=['POST'])
def get_paid_books():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Email required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT "Paid_Book" FROM "Users" WHERE "Email" = %s', (email,))
        row = cursor.fetchone()

        if row and row[0]:
            try:
                titles = json.loads(row[0])
            except Exception as e:
                print("Failed to parse Paid_Book JSON:", e)
                titles = []
        else:
            titles = []

        # ✅ log to see what's fetched
        print(f"[DEBUG] Paid books for {email}:", titles)
        conn.close()

        return jsonify({'success': True, 'paidBooks': titles})

    except Exception as e:
        print("Error in get_paid_books:", e)
        return jsonify({'success': False, 'message': str(e)}), 500
    
    
    
def dump_table_to_sql(cursor, table_name):
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    sql_statements = []
    for row in rows:
        values = []
        for val in row:
            if val is None:
                values.append("NULL")
            elif isinstance(val, str):
                values.append(f"'{val.replace('\'', '\'\'')}'")
            else:
                values.append(str(val))
        sql_statements.append(f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(values)});")
    return "\n".join(sql_statements)

@app.route("/backup", methods=["GET"])
def backup_databases():
    users_only = request.args.get("users") == "1"
    books_only = request.args.get("books") == "1"

    if not users_only and not books_only:
        return jsonify({"error": "No backup option selected"}), 400

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"Backup_Folder_admin_{timestamp}.zip"

    # Create an in-memory ZIP file
    memory_file = io.BytesIO()

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Users backup
            if users_only:
                users_sql = dump_table_to_sql(cursor, "Users")
                zipf.writestr("users.sql", users_sql)

            # Books backup
            if books_only:
                books_sql = dump_table_to_sql(cursor, "Books")
                zipf.writestr("books.sql", books_sql)

                # Add image and PDF backups
                for root, _, files in os.walk(UPLOAD_COVERS):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.join("covers", os.path.relpath(file_path, UPLOAD_COVERS))
                        zipf.write(file_path, arcname)

                for root, _, files in os.walk(UPLOAD_PDFS):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.join("pdfs", os.path.relpath(file_path, UPLOAD_PDFS))
                        zipf.write(file_path, arcname)

        conn.close()

        # Rewind the in-memory file
        memory_file.seek(0)

        # Send as downloadable file
        return send_file(
            memory_file,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )

    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500



@app.route("/get-users", methods=["GET"])
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT "UserID", "FullName", "Email", "Password", "Cart",
               "Paid_Book", "Date_Joined"
        FROM "Users"
        LIMIT 1000
    """)
    columns = [column[0] for column in cursor.description]
    users = [dict(zip(columns, row)) for row in cursor.fetchall()]
    conn.close()
    return jsonify(users)


@app.route("/upload-pdf/<int:book_id>", methods=["POST"])
def upload_pdf(book_id):
    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"success": False, "message": "Empty filename"}), 400

    # ✅ Secure filename
    original_name = secure_filename(file.filename)

    # ✅ Remove leading 'books-pdf_' if present
    clean_name = original_name
    if clean_name.startswith("books-pdf_"):
        clean_name = clean_name[len("books-pdf_"):]

    # ✅ Save inside books-pdf folder
    save_dir = os.path.join(UPLOAD_PDFS)
    os.makedirs(save_dir, exist_ok=True)
    save_path = os.path.join(save_dir, clean_name)
    file.save(save_path)

    # ✅ Relative path for DB
    db_path = f"books-pdf/{clean_name}".replace("\\", "/")

    print(f"[DEBUG] Uploaded PDF for book {book_id}: {db_path}")

    return jsonify({"success": True, "path": db_path})






@app.route("/add-book", methods=["POST"])
def add_book():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Get form values or set defaults
        title = request.form.get("title") or "Untitled Book"
        description = request.form.get("description") or ""
        price = request.form.get("price", "0").replace("$", "").strip()
        category = request.form.get("category") or "Uncategorized"
        rating = request.form.get("rating") or 0
        year = request.form.get("year") or 2025
        pages = request.form.get("pages") or 0
        isbn = request.form.get("isbn") or ""
        author = "Herb Schildt"  # Automatically set author

        # Handle files and web links
        cover_file = request.files.get("book_cover")
        pdf_file = request.files.get("book_pdf")
        web_link = request.form.get("web_link")

        cover_path = None
        pdf_path = None
        amazon = None

        # ✅ Save cover image only if not already there
        if cover_file:
            cover_name = secure_filename(cover_file.filename)
            cover_path_full = os.path.join(UPLOAD_COVERS, cover_name)

            if not os.path.exists(cover_path_full):  # avoid overwriting
                cover_file.save(cover_path_full)

            # Normalize path for web use
            cover_path = f"img/books/{cover_name}".replace("\\", "/")

        # ✅ Save PDF only if not already there
        if pdf_file:
            pdf_name = secure_filename(pdf_file.filename)
            pdf_path_full = os.path.join(UPLOAD_PDFS, pdf_name)

            if not os.path.exists(pdf_path_full):  # avoid overwriting
                pdf_file.save(pdf_path_full)

            # Normalize path
            pdf_path = f"books-pdf/{pdf_name}".replace("\\", "/")

        elif web_link:  # store Amazon link instead of PDF
            if "amazon" in web_link.lower():
                amazon = web_link

        print("Inserting into DB:", title, author, description, price, category, rating,
              cover_path, year, pages, isbn, pdf_path, amazon)

        # Insert into database
    cursor.execute("""
        INSERT INTO "Books" ("title", "author", "description", "price", "category", "rating",
                             "image", "year", "pages", "isbn", "pdf", "amazon", "noStock")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
            title, author, description, float(price), category, float(rating),
            cover_path, year, pages, isbn, pdf_path, amazon, 0
        ))

        conn.commit()
        print("Insert successful")
        return jsonify({"message": "Book added successfully!"}), 201

    except Exception:
        conn.rollback()
        import traceback
        return f"<pre>{traceback.format_exc()}</pre>", 500

    finally:
        conn.close()


        

@app.route('/delete-user/<int:user_id>', methods=['POST'])
def delete_user(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Delete user by ID
        cursor.execute('DELETE FROM "Users" WHERE "UserID" = %s', (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"success": True, "message": "User deleted successfully"}), 200

    except Exception as e:
        print("DB Error:", e)
        return jsonify({"success": False, "message": "Database error occurred"}), 500
        
        
import os

@app.route("/delete-book/<int:book_id>", methods=["DELETE"])
def delete_book(book_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1️⃣ Retrieve the file paths first
        cursor.execute('SELECT "pdf", "image" FROM "Books" WHERE "id" = %s', (book_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Book not found"}), 404

        pdf_path, cover_path = row

        # 2️⃣ Delete the files if they exist
        if pdf_path:
            pdf_full_path = os.path.join(UPLOAD_PDFS, os.path.basename(pdf_path))
            if os.path.exists(pdf_full_path):
                os.remove(pdf_full_path)

        if cover_path:
            cover_full_path = os.path.join(UPLOAD_COVERS, os.path.basename(cover_path))
            if os.path.exists(cover_full_path):
                os.remove(cover_full_path)

        # 3️⃣ Delete the DB record
        cursor.execute('DELETE FROM "Books" WHERE "id" = %s', (book_id,))
        conn.commit()

        return jsonify({"message": "Book and associated files deleted successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()



@app.route("/get-fullname", methods=["POST"])
def get_fullname():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT "FullName"
        FROM "Users"
        WHERE "Email" = %s
    """, (email,))
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({"success": True, "fullName": user[0]})
    else:
        return jsonify({"success": False, "message": "User not found"}), 404


#@app.route("/get-books", methods=["GET"])
#def get_books():
#    conn = get_db_connection()
#    cursor = conn.cursor()
#    cursor.execute("""
#        SELECT id, title, author, description, price, category, rating,
#               image, year, pages, isbn, pdf, amazon, noStock
#        FROM Books
#    """)
#
#    columns = [column[0] for column in cursor.description]
#    books = []
#    for row in cursor.fetchall():
#        books.append(dict(zip(columns, row)))
#
#    conn.close()
#    return jsonify(books)


@app.route("/get-books", methods=["GET"])
def get_books():
    try:
        with open(BOOKS_JSON_PATH, "r", encoding="utf-8") as f:
            books = json.load(f)
        return jsonify(books)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/pay-cart', methods=['POST'])
def pay_cart():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'success': False, 'message': 'Missing email'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get existing Cart and Paid_Book values
        cursor.execute('SELECT "Cart", "Paid_Book" FROM "Users" WHERE "Email" = %s', (email,))
        row = cursor.fetchone()

        if not row or not row[0]:
            conn.close()
            return jsonify({'success': False, 'message': 'Cart is empty'}), 400

        cart_items = json.loads(row[0]) if row[0] else []   # list
        paid_books = json.loads(row[1]) if row[1] else []   # list

        # Merge and remove duplicates
        updated_paid_books = list(set(paid_books + cart_items))

        # Update Paid_Book (JSON) and clear Cart
        cursor.execute(
            'UPDATE "Users" SET "Paid_Book" = %s, "Cart" = NULL WHERE "Email" = %s',
            (json.dumps(updated_paid_books), email)
        )
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Cart moved to Paid_Book successfully'})

    except Exception as e:
        print("Error moving Cart to Paid_Book:", e)
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route("/clear-cart", methods=["POST"])
def clear_cart():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if user exists
    cursor.execute('SELECT "Cart" FROM "Users" WHERE "Email" = %s', (email,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    # Clear the cart
    cursor.execute('UPDATE "Users" SET "Cart" = NULL WHERE "Email" = %s', (email,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Cart cleared successfully"})

@app.route('/update-book/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    try:
        data = request.get_json(force=True)

        title = data.get("title")
        description = data.get("description")
        price = data.get("price")
        category = data.get("category")
        rating = data.get("rating")
        year = data.get("year")
        pages = data.get("pages")
        isbn = data.get("isbn")
        pdf_filename = data.get("pdf")  # filename only, not full path
        image_value = data.get("image")
        amazon = data.get("amazon")
        noStock = int(data.get("noStock", 0))

        # ✅ Clean PDF filename and build relative path
        if pdf_filename:
            clean_name = pdf_filename
            if pdf_filename.startswith("books-pdf_"):
                clean_name = pdf_filename[len("books-pdf_"):]
            pdf_rel_path = f"books-pdf/{secure_filename(clean_name)}"
        else:
            pdf_rel_path = None

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE "Books"
            SET "title" = %s,
                "description" = %s,
                "price" = %s,
                "category" = %s,
                "rating" = %s,
                "year" = %s,
                "pages" = %s,
                "isbn" = %s,
                "pdf" = %s,
                "image" = %s,
                "amazon" = %s,
                "noStock" = %s
            WHERE "id" = %s
        """, (
            title, description, price, category, rating, year, pages, isbn,
            pdf_rel_path, image_value, amazon, noStock, book_id
        ))

        conn.commit()
        conn.close()
        return jsonify({'message': 'Book updated successfully'})
    
    except Exception as e:
        print("ERROR:", e)
        return jsonify({'error': str(e)}), 500





@app.route("/upload-cover/<int:book_id>", methods=["POST"])
def upload_cover(book_id):
    try:
        # ✅ Check if file is included
        if "file" not in request.files:
            return jsonify({"success": False, "message": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"success": False, "message": "Empty filename"}), 400

        # ✅ Secure filename and save to img/books
        filename = secure_filename(file.filename)
        save_path = os.path.join(UPLOAD_COVERS, filename)
        file.save(save_path)

        # ✅ Save relative path to DB
        rel_path = f"img/books/{filename}"

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('UPDATE "Books" SET "image" = %s WHERE "id" = %s', (rel_path, book_id))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "Cover uploaded", "path": rel_path})

    except Exception as e:
        print("ERROR upload_cover:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/get-pdf/<int:book_id>", methods=["GET"])
def get_pdf(book_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT "pdf" FROM "Books" WHERE "id" = %s', (book_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if row and row[0]:
            # Return the relative path stored in DB
            return jsonify({"success": True, "pdf_path": row[0]})
        else:
            return jsonify({"success": False, "message": "PDF not found"}), 404

    except Exception as e:
        print("ERROR get_pdf:", e)
        return jsonify({"success": False, "message": str(e)}), 500

    





@app.route('/block-user/<int:user_id>', methods=['POST'])
def block_user(user_id):
    data = request.get_json()
    days = data.get('days', 0)

    if days < 1:
        return jsonify({"success": False, "message": "Invalid number of days"}), 400

    # Calculate unblock date and format as string for nvarchar
    unblock_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE "Users"
            SET "Blocked" = %s
            WHERE "UserID" = %s
        """, (unblock_date, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "message": f"User blocked for {days} day(s)"}), 200

    except Exception as e:
        print("DB Error:", e)
        return jsonify({"success": False, "message": "Database error occurred"}), 500
    
    


@app.route('/check-block/<int:user_id>', methods=['GET'])
def check_block(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Fetch the Blocked datetime
        cursor.execute('SELECT "Blocked" FROM "Users" WHERE "UserID" = %s', (user_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        blocked_value = row[0] if row else None

        if blocked_value and isinstance(blocked_value, datetime):
            if blocked_value > datetime.now():
                return jsonify({"blocked": True})

        return jsonify({"blocked": False})

    except Exception as e:
        print("DB Error:", e)
        return jsonify({"blocked": False}), 500


@app.route('/unblock-user/<int:user_id>', methods=['POST'])
def unblock_user(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Set Blocked column to NULL
        cursor.execute('UPDATE "Users" SET "Blocked" = NULL WHERE "UserID" = %s', (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"success": True, "message": "User unblocked successfully"})
    except Exception as e:
        print("DB Error:", e)
        return jsonify({"success": False, "message": "Database error occurred"})




@app.route("/add-to-cart", methods=["POST"])
def add_to_cart():
    data = request.json
    email = data.get("email")
    book_title = data.get("title")

    if not email or not book_title:
        return jsonify({"success": False, "message": "Missing email or title"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch existing cart
    cursor.execute('SELECT "Cart" FROM "Users" WHERE "Email" = %s', (email,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    cart_json = row[0] or "[]"
    cart = json.loads(cart_json)  # Now cart is a list of strings

    # Prevent duplicates
    if book_title in cart:
        conn.close()
        return jsonify({"success": False, "message": "Book already in cart"}), 409

    # Add new title
    cart.append(book_title)
    cart_str = json.dumps(cart)

    # Update database
    cursor.execute('UPDATE "Users" SET "Cart" = %s WHERE "Email" = %s', (cart_str, email))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "cart": cart})


@app.route("/get-cart", methods=["POST"])
def get_cart():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT "Cart" FROM "Users" WHERE "Email" = %s', (email,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    cart_json = row[0] or "[]"
    titles = json.loads(cart_json)  # list of titles

    books = []
    if titles:
        placeholders = ",".join(["%s"] * len(titles))
        cursor.execute(f'SELECT * FROM "Books" WHERE "title" IN ({placeholders})', tuple(titles))
        columns = [col[0] for col in cursor.description]
        for r in cursor.fetchall():
            books.append(dict(zip(columns, r)))

    conn.close()
    return jsonify({"success": True, "cart": books})


@app.route("/remove-from-cart", methods=["POST"])
def remove_from_cart():
    data = request.json
    email = data.get("email")
    book_id = data.get("bookId")  # ✅ get bookId from frontend

    if not email or not book_id:
        return jsonify({"success": False, "message": "Email and bookId required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # ✅ Get book title from Books table using bookId
    cursor.execute('SELECT "title" FROM "Books" WHERE "id" = %s', (book_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "Book not found"}), 404

    book_title = row[0]  # fetched title

    # ✅ Get user's cart
    cursor.execute('SELECT "Cart" FROM "Users" WHERE "Email" = %s', (email,))
    user_row = cursor.fetchone()
    if not user_row:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    cart_json = user_row[0] or "[]"
    cart = json.loads(cart_json)

    # ✅ Remove book by title from cart
    if book_title not in cart:
        conn.close()
        return jsonify({"success": False, "message": "Book not in cart"}), 404

    cart.remove(book_title)

    # ✅ Update cart in DB
    cursor.execute('UPDATE "Users" SET "Cart" = %s WHERE "Email" = %s',
                   (json.dumps(cart), email))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "removedTitle": book_title, "cart": cart})


@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    full_name = data.get('fullName', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()

    if not full_name or not email or not password:
        return jsonify({'success': False, 'message': 'All fields are required.'})

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if email already exists
        cursor.execute('SELECT COUNT(*) FROM "Users" WHERE "Email" = %s', (email,))
        if cursor.fetchone()[0] > 0:
            return jsonify({'success': False, 'message': 'Email is already registered.'})

        # Insert new user with Date_Joined
        date_joined = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO "Users" ("FullName", "Email", "Password", "Date_Joined", "Blocked", "Cart", "Paid_Book")
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (full_name, email, password, date_joined, 0, '', ''))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'message': 'Account created successfully!'})

    except Exception as e:
        print("Signup error:", e)
        return jsonify({'success': False, 'message': 'Failed to create account. Try again later.'})


@app.route('/update-password', methods=['POST'])
def update_password():
    data = request.get_json()
    email = data.get('email')
    new_password = data.get('password')

    if not email or not new_password:
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE "Users" SET "Password" = %s WHERE "Email" = %s', (new_password, email))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True, 'message': 'Password updated successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route("/", methods=["GET"])
def home():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))







