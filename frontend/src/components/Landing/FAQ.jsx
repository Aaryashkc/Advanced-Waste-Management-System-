'use client';

import { useState } from 'react';
import { Leaf } from 'lucide-react';

function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="border-b border-primary/10">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between gap-6 text-left cursor-pointer group"
      >
        <span className={`font-['Outfit'] font-medium text-lg transition-colors duration-300 ${isOpen ? 'text-primary' : 'text-primary/80 group-hover:text-primary'}`}>
          {question}
        </span>
        <Leaf
          className={`w-5 h-5 shrink-0 transition-all duration-300 ${
            isOpen ? 'text-primary rotate-45 scale-110' : 'text-primary/40 group-hover:text-primary/60'
          }`}
        />
      </button>

      {isOpen && (
        <div className="pb-6">
          <p className="font-['Outfit'] text-base text-primary/60 leading-relaxed">
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
      question: 'How are routes assigned?',
      answer:
        'Routes are assigned automatically each morning based on your collection schedule. The system distributes pickups evenly across available drivers and trucks.',
    },
    {
      question: 'Can drivers update their status in real time?',
      answer:
        'Yes. Drivers update pickup status in real time through the dashboard. You see changes immediately and can respond if something changes.',
    },
    {
      question: 'What waste types are supported?',
      answer:
        'The system handles all standard waste categories. Citizens specify type and volume when submitting requests, and you organize pickups accordingly.',
    },
    {
      question: 'How fast are on-demand requests fulfilled?',
      answer:
        'On-demand requests are dispatched within hours depending on truck availability. The dashboard shows estimated arrival time to the requester.',
    },
    {
      question: 'Can I manage multiple trucks and drivers?',
      answer:
        'The organizations panel lets you manage your entire fleet. Assign drivers, track trucks, and organize routes all from one place.',
    },
  ];

  return (
    <section className="bg-white w-full py-20 md:py-28 px-6 md:px-16 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-['Outfit'] font-bold text-primary text-3xl md:text-4xl mb-4">
            Frequently Asked Questions
          </h2>
          <p className="font-['Outfit'] text-primary/60 text-lg">
            Find answers to common questions about the platform
          </p>
        </div>

        <div>
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
