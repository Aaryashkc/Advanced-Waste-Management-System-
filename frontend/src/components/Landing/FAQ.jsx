'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="bg-white border border-black">
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between gap-6 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-['Roboto'] font-bold text-lg text-black flex-1">
          {question}
        </span>
        <X
          className={`w-6 h-6 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-0' : 'rotate-45'
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-6 pb-6">
          <p className="font-['Roboto'] text-base text-black leading-relaxed">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      question: 'How do routes assign?',
      answer:
        'Routes are assigned automatically each morning based on your collection schedule. The system distributes pickups evenly across available drivers and trucks. No manual work needed.',
    },
    {
      question: 'Can drivers update status?',
      answer:
        'Yes. Drivers update pickup status in real time through the dashboard. You see changes immediately and can respond if something changes.',
    },
    {
      question: 'What waste types work?',
      answer:
        'The system handles all standard waste categories. Citizens specify type and volume when submitting requests. You organize pickups accordingly.',
    },
    {
      question: 'How fast are requests?',
      answer:
        'On-demand requests are dispatched within hours depending on truck availability. The dashboard shows estimated arrival time to the requester.',
    },
    {
      question: 'Can I manage multiple trucks?',
      answer:
        'The organizations panel lets you manage your entire fleet. Assign drivers, track trucks, and organize routes all from one place.',
    },
  ];

  return (
    <section className="bg-white w-full py-16 md:py-24 px-8 md:px-16 lg:px-24">
      <div className="max-w-[768px] mx-auto">
        <div className="text-center mb-12 space-y-6">
          <h2 className="font-['Outfit'] font-bold text-black text-4xl md:text-5xl">
            FAQ
          </h2>
          <p className="font-['Outfit'] text-black text-lg">
            Find answers to common questions about the dashboard
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() =>
                setOpenIndex(openIndex === index ? null : index)
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
