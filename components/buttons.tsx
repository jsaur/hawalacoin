import { ButtonHTMLAttributes } from 'react';
import ClipLoader from "react-spinners/ClipLoader";


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

/**
 * Handles logic when a contract call is transacting by disabling the button and displaying a spinner
 */
export function ContractButton(
  props: ButtonHTMLAttributes<HTMLButtonElement>
): React.ReactElement {
  return (
    <button
      {...props}
      className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 w-20
        ${props.disabled ? 'cursor-not-allowed': 'hover:bg-indigo-700'} mt-2 ml-auto ${props.className || ''}`}
    >{props.disabled ? <ClipLoader size={15} /> : props.children}</button>
  );
}
