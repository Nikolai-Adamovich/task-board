import { Component } from '@angular/core';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';

@Component({
  selector: 'ui-support',
  imports: [HlmFieldImports, HlmInputImports, HlmTextareaImports, HlmButtonImports],
  templateUrl: './support.html',
})
export class Support {}
