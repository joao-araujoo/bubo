import React from 'react';
import BookCard from './BookCard';

export default function LibraryGrid({ userBooks, onDeepReview }) {
  if (!userBooks || userBooks.length === 0) {
    return (
      <div className="text-center py-16 text-[#BDBDBD]">
        <p className="text-lg">Your library is empty</p>
        <p className="text-sm mt-2">Search and add books to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {userBooks.map((userBook) => (
        <BookCard key={userBook._id} userBook={userBook} onDeepReview={onDeepReview} />
      ))}
    </div>
  );
}
