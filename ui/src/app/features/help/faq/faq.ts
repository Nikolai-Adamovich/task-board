import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmAccordionImports } from '@spartan-ng/helm/accordion';

@Component({
  selector: 'ui-faq',
  imports: [TranslocoPipe, HlmAccordionImports],
  templateUrl: './faq.html',
})
export class Faq {
  protected readonly faqItems = [
    { question: 'faq.q1.question', answer: 'faq.q1.answer' },
    { question: 'faq.q2.question', answer: 'faq.q2.answer' },
    { question: 'faq.q3.question', answer: 'faq.q3.answer' },
    { question: 'faq.q4.question', answer: 'faq.q4.answer' },
    { question: 'faq.q5.question', answer: 'faq.q5.answer' },
  ];
}
