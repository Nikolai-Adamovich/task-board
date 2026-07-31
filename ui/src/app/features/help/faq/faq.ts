import { Component } from '@angular/core';
import { HlmAccordionImports } from '@spartan-ng/helm/accordion';

@Component({
  selector: 'ui-faq',
  imports: [HlmAccordionImports],
  templateUrl: './faq.html',
})
export class Faq {
  protected readonly faqItems = [
    {
      question: 'What is Task Board?',
      answer:
        'Task Board is a collaborative project management application that helps teams organize work using boards, columns, tasks, and sprints. It supports multiple workspaces, role-based access control, and real-time collaboration.',
    },
    {
      question: 'How do I create a project?',
      answer:
        'Navigate to your workspace, click the "Projects" section, and use the "Create Project" button. You will need to provide a project name and optional description. Projects are scoped to your current workspace.',
    },
    {
      question: 'How do I invite team members?',
      answer:
        'Go to your workspace settings and open the "Members" tab. Click "Invite Member", enter their email address, and assign a role (Owner, Admin, or Member). They will receive an email invitation to join your workspace.',
    },
    {
      question: 'What are subscription tiers?',
      answer:
        'Task Board offers Free, Pro, and Enterprise tiers. The Free tier includes basic board and task management. Pro adds advanced features like sprints and analytics. Enterprise includes priority support, SSO, and unlimited workspaces.',
    },
    {
      question: 'How do I change my theme?',
      answer:
        'Click your avatar in the top-right corner to open the user menu. From there you can toggle between light and dark mode, and adjust the interface zoom level to your preference.',
    },
  ];
}
