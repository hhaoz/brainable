import { Component, EventEmitter, inject, NgZone, Output } from '@angular/core';
import {
  MatDialog,
  MatDialogConfig,
  MatDialogRef,
} from '@angular/material/dialog';
import * as XLSX from 'xlsx';
import { MaterialModule } from '../../../../../shared/modules/material.module';
import { SharedModule } from '../../../../../shared/modules/shared.module';
import { Question } from '../../../../../models/question.model';
import * as QuizActions from '../../../../../ngrx/quiz/quiz.actions';
import { Store } from '@ngrx/store';
import { QuizState } from '../../../../../ngrx/quiz/quiz.state';
import mammoth from 'mammoth';
import * as Papa from 'papaparse';
import { DialogImportNotificationComponent } from '../dialog-import-notification/dialog-import-notification.component';
import { AlertService } from '../../../../../services/alert/alert.service';

@Component({
  selector: 'app-dialog-create',
  standalone: true,
  imports: [MaterialModule, SharedModule],
  templateUrl: './dialog-create.component.html',
  styleUrl: './dialog-create.component.scss',
})
export class DialogCreateComponent {
  constructor(
    private dialogRef: MatDialogRef<DialogCreateComponent>,
    private store: Store<{ quiz: QuizState }>,
    private alertService: AlertService,
  ) {}

  handleFileInput(event: any) {
    const file = event.target.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        this.readExcel(event);
      } else if (fileName.endsWith('.docx')) {
        this.readWord(event);
      } else if (fileName.endsWith('.csv')) {
        this.onFileSelectedCSV(event);
      } else {
        this.alertService.showAlertError(
          'Unsupported file type',
          'Error',
          3000,
          'start',
          'bottom',
        );
      }
    }
  }

  readExcel(event: any) {
    let file = event.target.files[0];
    let fileReader = new FileReader();
    fileReader.readAsBinaryString(file);

    fileReader.onload = (e) => {
      const workBook = XLSX.read(fileReader.result, { type: 'binary' });
      const sheetName = workBook.SheetNames[0]; // Get the first sheet
      const worksheet = workBook.Sheets[sheetName];

      // Convert the entire sheet to JSON while using the first row as headers
      const excelData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];

      // Extract headers (the first row)
      const headers = excelData[0]; // ["Question", "Option1", "Option2", "Option3", "Option4", "Answer"]
      const expectedHeaders = [
        'Question',
        'Option1',
        'Option2',
        'Option3',
        'Option4',
        'Answer',
      ];

      // Validate if headers match expected format
      const isValidHeaders =
        headers.length === expectedHeaders.length &&
        headers.every((header, index) => header === expectedHeaders[index]);

      if (!isValidHeaders) {
        // Open the dialog to notify about header mismatch
        this.alertService.showAlertError(
          'The file headers do not match the expected format',
          'Error',
          3000,
          'start',
          'bottom',
        );
        return;
      }

      // Extract rows starting from the second row (skipping the headers)
      const rows = excelData.slice(1);

      // Validate and process rows
      const formattedData: Question[] = [];
      const missingFieldsMessages: string[] = [];

      rows.forEach((row, index) => {
        const questionObj: Partial<Question> = {
          question: row[0] ? String(row[0]).trim() : '',
          option1: row[1] ? String(row[1]).trim() : '',
          option2: row[2] ? String(row[2]).trim() : '',
          option3: row[3] ? String(row[3]).trim() : '',
          option4: row[4] ? String(row[4]).trim() : '',
          answer:
            row[5] !== undefined && row[5] !== null && row[5] !== ''
              ? Number(row[5])
              : NaN, // Improved answer validation
        };

        // Validate each row for missing fields
        const missingFields = this.getMissingFieldsExcel(questionObj);
        if (missingFields.length > 0) {
          missingFieldsMessages.push(
            `Row ${index + 2}: Missing fields: ${missingFields.join(', ')}`,
          );
        } else {
          formattedData.push({
            id: '',
            imgUrl: '',
            question: questionObj.question!,
            option1: questionObj.option1!,
            option2: questionObj.option2!,
            option3: questionObj.option3!,
            option4: questionObj.option4!,
            answer: questionObj.answer!, // This should now correctly handle the answer field
            timeLimit: 10,
            points: 1,
          });
        }
      });

      // If there are missing fields, open the dialog
      if (missingFieldsMessages.length > 0) {
        this.alertService.showAlertError(
          'Import failed! Missing fields',
          'Error',
          3000,
          'start',
          'bottom',
        );
        (event.target as HTMLInputElement).value = '';
        return;
      }

      // Log the valid formatted data for debugging

      // Dispatch the formatted data to the store
      this.store.dispatch(
        QuizActions.updateQuestionByImport({ questions: formattedData }),
      );

      this.closeDialog();
    };
  }

  getMissingFieldsExcel(questionObj: Partial<Question>): string[] {
    const missingFields: string[] = [];

    if (!questionObj.question || questionObj.question.trim() === '') {
      missingFields.push('Question');
    }
    if (!questionObj.option1 || questionObj.option1.trim() === '') {
      missingFields.push('Option1');
    }
    if (!questionObj.option2 || questionObj.option2.trim() === '') {
      missingFields.push('Option2');
    }
    if (!questionObj.option3 || questionObj.option3.trim() === '') {
      missingFields.push('Option3');
    }
    if (!questionObj.option4 || questionObj.option4.trim() === '') {
      missingFields.push('Option4');
    }
    // Check if answer is NaN or an empty value
    if (isNaN(questionObj.answer!) || questionObj.answer === null) {
      missingFields.push('Answer');
    }

    return missingFields;
  }

  questions: Question[] = []; // Declare questions array to store parsed data

  readWord(event: any) {
    if (
      !event ||
      !event.target ||
      !event.target.files ||
      event.target.files.length === 0
    ) {
      return;
    }

    const file = event.target.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        if (!e || !e.target || !e.target.result) {
          return;
        }

        const arrayBuffer = e.target.result;

        mammoth
          .extractRawText({ arrayBuffer: arrayBuffer })
          .then((result) => {
            const extractedText = result.value;
            this.parseText(extractedText, event); // Ensure event is passed to parseText
          })
          .catch((err) => {});
      };

      reader.readAsArrayBuffer(file);
    }
  }

  parseText(text: string, event: any) {
    // Clear the questions array before parsing a new file
    this.questions = [];

    const lines = text.split('\n'); // Split text by line breaks
    let questionObj: Partial<Question> = {};
    let isValid = true; // Variable to track overall validity
    const missingFields: string[] = []; // Accumulate all missing fields

    // Variables to track the required fields in the expected order
    let questionExists = false;
    let option1Exists = false;
    let option2Exists = false;
    let option3Exists = false;
    let option4Exists = false;
    let answerExists = false;

    lines.forEach((line) => {
      if (line.startsWith('Question:')) {
        // Before starting a new question, check if the previous question is valid
        if (
          questionExists &&
          option1Exists &&
          option2Exists &&
          option3Exists &&
          option4Exists &&
          answerExists
        ) {
          this.questions.push(questionObj as Question); // Push the completed question
        } else if (questionExists) {
          isValid = false; // If any of the options or answer is missing, mark as invalid
          missingFields.push(
            'Incomplete question structure found. Missing fields in one of the questions.',
          );
        }

        // Reset the tracking variables for the new question
        questionExists = true;
        option1Exists =
          option2Exists =
          option3Exists =
          option4Exists =
          answerExists =
            false;
        questionObj = {
          question: line.replace('Question:', '').trim(),
          timeLimit: 10,
          points: 1,
        };
      } else if (line.startsWith('Option1:')) {
        const option1Text = line.replace('Option1:', '').trim();
        if (option1Text === '') {
          option1Exists = false; // Mark option as missing
          missingFields.push('Option1');
        } else {
          questionObj.option1 = option1Text;
          option1Exists = true;
        }
      } else if (line.startsWith('Option2:')) {
        const option2Text = line.replace('Option2:', '').trim();
        if (option2Text === '') {
          option2Exists = false; // Mark option as missing
          missingFields.push('Option2');
        } else {
          questionObj.option2 = option2Text;
          option2Exists = true;
        }
      } else if (line.startsWith('Option3:')) {
        const option3Text = line.replace('Option3:', '').trim();
        if (option3Text === '') {
          option3Exists = false; // Mark option as missing
          missingFields.push('Option3');
        } else {
          questionObj.option3 = option3Text;
          option3Exists = true;
        }
      } else if (line.startsWith('Option4:')) {
        const option4Text = line.replace('Option4:', '').trim();
        if (option4Text === '') {
          option4Exists = false; // Mark option as missing
          missingFields.push('Option4');
        } else {
          questionObj.option4 = option4Text;
          option4Exists = true;
        }
      } else if (line.startsWith('Answer:')) {
        const answerText = line.replace('Answer:', '').trim();
        if (answerText === '' || isNaN(Number(answerText))) {
          answerExists = false; // Ensure answer is valid and not missing
          missingFields.push('Answer');
        } else {
          questionObj.answer = Number(answerText);
          answerExists = true;
        }
      }
    });

    // Validate the last question after the loop finishes
    if (
      questionExists &&
      option1Exists &&
      option2Exists &&
      option3Exists &&
      option4Exists &&
      answerExists
    ) {
      this.questions.push(questionObj as Question); // Push the last question
    } else {
      isValid = false;
      missingFields.push(
        'Incomplete question structure found in the last question.',
      );
    }

    // If any question is invalid, show an error and stop the import
    if (!isValid) {
      // this.alertService.showAlertError(`Import failed! Missing fields: ${missingFields.join(', ')}`, 'Error', 3000, 'start', 'bottom');
      this.alertService.showAlertError(
        `Import failed! Unsupported format or Missing fields`,
        'Error',
        3000,
        'start',
        'bottom',
      );
      // Reset the file input element after an error
      this.resetFileInput(event);
      return; // Stop further processing
    }

    // Process valid questions if all passed validation
    this.closeDialog();
    this.store.dispatch(
      QuizActions.updateQuestionByImportWord({ questions: this.questions }),
    );

    // Reset the file input element after successful import
    this.resetFileInput(event);
  }

  // Function to reset the file input field to allow re-importing
  resetFileInput(event: any) {
    if (event.target) {
      (event.target as HTMLInputElement).value = ''; // Reset the input element
    }
  }

  // Function to validate the question object and notify user of missing fields
  //   isValidQuestion(questionObj: Partial<Question>, missingFields: string[]): boolean {
  //     // Clear the missing fields for this validation
  //     missingFields.length = 0;
  //
  //     // Check each required field and log if missing
  //     if (
  //       typeof questionObj.question !== 'string' ||
  //       questionObj.question.trim() === ''
  //     ) {
  //       missingFields.push('Question');
  //     }
  //     if (
  //       typeof questionObj.option1 !== 'string' ||
  //       questionObj.option1.trim() === ''
  //     ) {
  //       missingFields.push('Option1');
  //     }
  //     if (
  //       typeof questionObj.option2 !== 'string' ||
  //       questionObj.option2.trim() === ''
  //     ) {
  //       missingFields.push('Option2');
  //     }
  //     if (
  //       typeof questionObj.option3 !== 'string' ||
  //       questionObj.option3.trim() === ''
  //     ) {
  //       missingFields.push('Option3');
  //     }
  //     if (
  //       typeof questionObj.option4 !== 'string' ||
  //       questionObj.option4.trim() === ''
  //     ) {
  //       missingFields.push('Option4');
  //     }
  //     if (isNaN(questionObj.answer!)) {
  //       missingFields.push('Answer');
  //     }
  //
  //     // If any missing fields are detected, mark the question as invalid
  //     return missingFields.length === 0;
  //   }

  parsedData: any[] = []; // Declare parsedData to store the CSV data

  onFileSelectedCSV(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.parseCSV(file, event); // Ensure event is passed to parseCSV
    }
  }

  parseCSV(file: File, event: any): void {
    if (!event) return; // Safety check to ensure event is defined

    Papa.parse(file, {
      header: true, // Parse with headers
      complete: (result) => {
        const missingDataMessages: string[] = [];

        this.parsedData = result.data.map((row: any, index: number) => {
          const missingFields: string[] = [];

          // Check for missing fields
          if (!row['question']) missingFields.push('question');
          if (!row['option1']) missingFields.push('option1');
          if (!row['option2']) missingFields.push('option2');
          if (!row['option3']) missingFields.push('option3');
          if (!row['option4']) missingFields.push('option4');
          if (!row['answer']) missingFields.push('answer');

          // If missing fields, add a message for the user
          if (missingFields.length > 0) {
            missingDataMessages.push(
              `Row ${index + 1} is missing: ${missingFields.join(', ')}`,
            );
          }

          // Return formatted question object
          return {
            id: '',
            imgUrl: '',
            question: String(row['question']), // Ensure question is a string
            option1: String(row['option1']), // Ensure option1 is a string
            option2: String(row['option2']), // Ensure option2 is a string
            option3: String(row['option3']), // Ensure option3 is a string
            option4: String(row['option4']), // Ensure option4 is a string
            answer: Number(row.answer), // Ensure answer is a number
            timeLimit: 10,
            points: 1,
          };
        });

        // Notify the user if there are missing fields
        if (missingDataMessages.length > 0) {
          this.alertService.showAlertError(
            'Import failed! Missing fields',
            'Error',
            3000,
            'start',
            'bottom',
          );

          // Reset the file input element after an error
          if (event.target) {
            (event.target as HTMLInputElement).value = '';
          }
        } else {
          // Dispatch the action if no issues are found
          this.store.dispatch(
            QuizActions.updateQuestionByImportCSV({
              questions: this.parsedData,
            }),
          );

          // Reset the file input element after successful import
          if (event.target) {
            (event.target as HTMLInputElement).value = '';
          }
          this.closeDialog();
        }
      },
      error: (error) => {
        this.alertService.showAlertError(
          'Error parsing CSV file. Please try again.',
          'Error',
          3000,
          'start',
          'bottom',
        );

        // Reset the file input element in case of error
        if (event.target) {
          (event.target as HTMLInputElement).value = '';
        }
      },
    });
  }

  dialog = inject(MatDialog);

  // Function to get missing fields from a question object
  // getMissingFields(questionObj: Partial<Question>): string[] {
  //   const missingFields: string[] = [];
  //
  //   if (!questionObj.question || questionObj.question.trim() === '') {
  //     missingFields.push('Question');
  //   }
  //   if (!questionObj.option1 || questionObj.option1.trim() === '') {
  //     missingFields.push('Option1');
  //   }
  //   if (!questionObj.option2 || questionObj.option2.trim() === '') {
  //     missingFields.push('Option2');
  //   }
  //   if (!questionObj.option3 || questionObj.option3.trim() === '') {
  //     missingFields.push('Option3');
  //   }
  //   if (!questionObj.option4 || questionObj.option4.trim() === '') {
  //     missingFields.push('Option4');
  //   }
  //   if (typeof questionObj.answer !== 'number') {
  //     missingFields.push('Answer');
  //   }
  //
  //   return missingFields;
  // }

  closeDialog(): void {
    this.dialogRef.close();
  }

  downloadFile(event: MouseEvent, type: 'docx' | 'xlsx' | 'csv'): void {
    // Define the path to the file
    const wordFile = '../../../../assets/example-file/example.docx';
    const excelFile = '../../../../assets/example-file/example.xlsx';
    const csvFile = '../../../../assets/example-file/example.csv';
    const exampleFiles = [
      { type: 'docx', path: wordFile },
      { type: 'xlsx', path: excelFile },
      { type: 'csv', path: csvFile },
    ];
    const fileNames = ['example.docx', 'example.xlsx', 'example.csv'];

    // Create a link element
    const link = document.createElement('a');
    link.href = exampleFiles.find((file) => file.type === type)?.path || '';
    link.download = fileNames.find((file) => file.endsWith(type)) || '';

    // Append the link to the body (required for Firefox)
    document.body.appendChild(link);

    // Trigger the download
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
  }
}
