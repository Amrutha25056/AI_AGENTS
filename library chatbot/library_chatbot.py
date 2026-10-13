
# Simple College Library Chatbot

books = [
    {"title": "Harry Potter and the Philosopher's Stone", "author": "J. K. Rowling"},
    {"title": "The Hobbit", "author": "J. R. R. Tolkien"},
    {"title": "The Diary of a Young Girl", "author": "Anne Frank"},
    {"title": "Charlotte's Web", "author": "E. B. White"},
    {"title": "The Little Prince", "author": "Antoine de Saint-Exupéry"}
]

print("Welcome to the School Library Chatbot!")
print("Ask about a book, or type 'exit' to stop.")

while True:
    question = input("\nYou: ").lower()

    if question == "exit":
        print("Chatbot: Goodbye!")
        break

    found_book = None

    for book in books:
        if book["title"].lower() in question:
            found_book = book
            break

    if found_book:
        print(
            f"Chatbot: Yes, we have '{found_book['title']}' "
            f"by {found_book['author']}."
        )
    else:
        print("Chatbot: That book is not available in our library.")