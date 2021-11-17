import { ButtonHTMLAttributes } from 'react';

/**
 * Handles logic when a contract call is transacting by disabling the button and displaying a spinner
 */
 export function PrimaryButton(
  props: ButtonHTMLAttributes<HTMLButtonElement>
): React.ReactElement {
  return (
    <button
      {...props}
      className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 ${
        props.disabled
          ? 'cursor-not-allowed'
          : 'hover:indigo-700'
      } mt-2 ml-auto ${props.className || ''}`}
    />
  );
}

// export function ContractButton(props: any) {
//   return (
//     <Button variant="contained" className={props.classes} onClick={props.onClick} disabled={props.transacting}>
//       {props.transacting ? 
//         (<CircularProgress color="inherit" size="1rem" />) 
//         :
//         (props.text)
//       }
//     </Button>
//   );
// }


